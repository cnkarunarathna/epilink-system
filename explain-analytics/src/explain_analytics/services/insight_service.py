import json

from google import genai

from explain_analytics.config import settings
from explain_analytics.models import (
    ExplainInsightRequest,
    ExplainInsightResponse,
    RiskLevel,
)


class ExplainabilityService:
    """Phase 1 service that turns structured analytics into concise insights."""

    @staticmethod
    def _classify_risk(score: float) -> RiskLevel:
        if score >= 0.85:
            return "critical"
        if score >= 0.65:
            return "high"
        if score >= 0.4:
            return "moderate"
        return "low"

    @staticmethod
    def _normalize_risk_level(value: str | None, fallback: RiskLevel) -> RiskLevel:
        if value in {"low", "moderate", "high", "critical"}:
            return value
        return fallback

    @staticmethod
    def _ensure_list_of_strings(value: object, fallback: list[str]) -> list[str]:
        if not isinstance(value, list):
            return fallback
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return cleaned if cleaned else fallback

    def _generate_rule_based_insight(
        self, payload: ExplainInsightRequest
    ) -> ExplainInsightResponse:
        risk_level = self._classify_risk(payload.structured_signals.model_risk_score)
        drivers: list[str] = []

        wow_change = payload.structured_signals.wow_case_change_pct
        if wow_change is not None:
            if wow_change >= 10:
                drivers.append(
                    f"Reported cases increased by {wow_change:.1f}% week-over-week"
                )
            elif wow_change <= -10:
                drivers.append(
                    f"Reported cases decreased by {abs(wow_change):.1f}% week-over-week"
                )

        rainfall = payload.structured_signals.rainfall_mm_7d
        if rainfall is not None and rainfall >= 80:
            drivers.append(
                f"High recent rainfall ({rainfall:.1f} mm in 7 days) can increase vector breeding"
            )

        if not drivers:
            drivers.append(
                "Model risk score is the primary indicator in the current signal set"
            )

        recommendations = [
            "Increase field surveillance in high-incidence neighborhoods",
            "Reinforce community source reduction campaigns for stagnant water",
        ]
        if risk_level in ("high", "critical"):
            recommendations.insert(
                0, "Prioritize rapid response teams and targeted fogging in hotspots"
            )

        caveats = [
            "This explanation is generated from structured signals (Phase 1) and not full RAG evidence yet"
        ]

        if (
            payload.structured_signals.uncertainty_lower is not None
            and payload.structured_signals.uncertainty_upper is not None
        ):
            low = payload.structured_signals.uncertainty_lower
            high = payload.structured_signals.uncertainty_upper
            caveats.append(f"Forecast uncertainty range: {low:.2f} to {high:.2f}")

        references = payload.rag_context[:3]

        summary = (
            f"{payload.district} is currently assessed as {risk_level} risk "
            f"based on a model score of {payload.structured_signals.model_risk_score:.2f}."
        )

        return ExplainInsightResponse(
            district=payload.district,
            risk_level=risk_level,
            summary=summary,
            key_drivers=drivers,
            recommendations=recommendations,
            caveats=caveats,
            references=references,
            implementation_phase="phase-1-structured-data-to-text",
        )

    def _generate_with_gemini(
        self, payload: ExplainInsightRequest, baseline: ExplainInsightResponse
    ) -> ExplainInsightResponse:
        if settings.llm_provider.lower() != "gemini":
            return baseline
        if not settings.gemini_api_key:
            return baseline

        prompt = (
            "You are an expert public health dengue analyst for Sri Lanka. "
            "Return valid JSON only with this schema: "
            '{"risk_level":"low|moderate|high|critical","summary":"...",'
            '"key_drivers":["..."],"recommendations":["..."],"caveats":["..."]}. '
            "Keep the response concise and actionable. "
            f"Input data: {json.dumps(payload.model_dump(), ensure_ascii=True)}"
        )

        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": settings.default_temperature,
            },
        )

        text = (response.text or "").strip()
        if not text:
            return baseline

        generated = json.loads(text)

        return ExplainInsightResponse(
            district=payload.district,
            risk_level=self._normalize_risk_level(
                generated.get("risk_level"), baseline.risk_level
            ),
            summary=str(generated.get("summary") or baseline.summary),
            key_drivers=self._ensure_list_of_strings(
                generated.get("key_drivers"), baseline.key_drivers
            ),
            recommendations=self._ensure_list_of_strings(
                generated.get("recommendations"), baseline.recommendations
            ),
            caveats=self._ensure_list_of_strings(
                generated.get("caveats"), baseline.caveats
            ),
            references=payload.rag_context[:3],
            implementation_phase="phase-1-structured-data-to-text-gemini",
        )

    def generate_insight(
        self, payload: ExplainInsightRequest
    ) -> ExplainInsightResponse:
        baseline = self._generate_rule_based_insight(payload)
        try:
            return self._generate_with_gemini(payload, baseline)
        except Exception:
            return baseline
