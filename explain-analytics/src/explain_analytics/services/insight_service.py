import json

from google import genai

from explain_analytics.config import settings
from explain_analytics.models import (
    DocumentReference,
    ExplainInsightRequest,
    ExplainInsightResponse,
    RiskLevel,
    StructuredSignals,
    TrendDirection,
)
from explain_analytics.services.rag_service import RAGService

SYSTEM_PROMPT = """\
You are a **Senior Epidemiologist** specializing in dengue fever analytics \
for the Sri Lankan Ministry of Health, integrated into the EpiLink Decision \
Support System.

Your task: given structured surveillance signals for a single district, \
produce a concise but insightful JSON analysis that a Medical Officer of \
Health (MOH) can immediately act upon.

## Sri Lanka Dengue Context
- Sri Lanka has two peak transmission seasons driven by monsoons:
  southwest monsoon (May–September, affects western/southern/central provinces)
  and northeast monsoon (October–January, affects eastern/northern provinces).
- Aedes aegypti is the primary vector; its larval development accelerates
  above 28 °C and stalls below 16 °C.
- A 7-day rainfall total above 80 mm creates significant standing-water
  breeding sites; above 120 mm signals extensive risk.
- A week-over-week (WoW) case increase ≥ 15 % is an early outbreak signal.
- Districts with ≥ 100 cases/week require emergency-level response.

## Output JSON schema (all fields required)
{
  "risk_level": "low | moderate | high | critical",
  "summary": "A 2–3 sentence narrative explaining the current situation in \
plain language. Mention the district name, the case count, the trend, and \
the main reason for the assigned risk level.",
  "key_drivers": ["3–5 bullet strings identifying the primary factors \
driving the risk assessment, e.g. rainfall, temperature, WoW change, \
historical trajectory"],
  "recommendations": ["3–5 specific, actionable public-health \
recommendations tailored to the risk level and drivers"],
  "caveats": ["1–3 short caveats about model limitations or data gaps"],
  "confidence_score": 0-100,
  "trend_direction": "rising | falling | stable"
}

## Feature Importance Interpretation
- If `structured_signals.feature_importances` is present, it contains \
SHAP-based feature contributions from the XGBoost/LightGBM ensemble. \
Values are fractional (0.0–1.0) representing each feature's share of \
the predicted risk score.
- When feature_importances is provided, derive `key_drivers` from the \
top 3–5 features ranked by their importance value. State the percentage \
contribution explicitly for each.
- Example key_driver format: "Rainfall (7-day total: 95 mm) is the \
dominant driver, contributing 42% of the model's predicted risk score."
- If feature_importances is absent, infer key drivers from signal \
thresholds as usual.

## Guidelines
- Be specific to dengue in Sri Lanka; reference tropical weather patterns.
- If rainfall > 80 mm / 7 days, highlight vector breeding risk explicitly.
- If WoW change > 15 %, emphasize the acceleration and early-warning status.
- Derive trend_direction from the historical_trend array: compare recent \
weeks to detect rising/falling/stable patterns.
- confidence_score should reflect data completeness (all signals present → \
higher) and model certainty (narrow uncertainty_lower/upper band → higher). \
Presence of feature_importances indicates a fully explainable prediction \
and should increase confidence.
- Keep each string concise (max 2 sentences per bullet).
- Do NOT include any markdown, only valid JSON.
"""


# Human-readable labels for known ML feature names.
# Unknown feature names fall back to title-cased snake_case.
_FEATURE_LABELS: dict[str, str] = {
    "rainfall_mm_7d": "Rainfall (7-day cumulative)",
    "temperature_c_7d": "Average temperature (7-day)",
    "wow_case_change_pct": "Week-over-week case change",
    "recent_case_count": "Current case burden",
    "historical_trend": "Historical case trajectory",
    "humidity_pct": "Relative humidity",
    "population_density": "Population density",
    "urbanization_index": "Urbanization level",
    "vector_index": "Mosquito vector index",
    "lag_1w_cases": "Lagged cases (1 week prior)",
    "lag_2w_cases": "Lagged cases (2 weeks prior)",
    "lag_3w_cases": "Lagged cases (3 weeks prior)",
}


class ExplainabilityService:
    """Turns structured analytics into concise, actionable insights."""

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
    def _derive_trend(historical: list[int]) -> TrendDirection:
        if len(historical) < 2:
            return "stable"
        # historical_trend is most-recent first: [week_n, week_n-1, week_n-2, ...]
        recent_half = historical[: len(historical) // 2]
        older_half = historical[len(historical) // 2 :]
        avg_recent = sum(recent_half) / len(recent_half)
        avg_older = sum(older_half) / len(older_half)
        if avg_recent > avg_older * 1.10:
            return "rising"
        if avg_recent < avg_older * 0.90:
            return "falling"
        return "stable"

    @staticmethod
    def _normalize_risk_level(value: str | None, fallback: RiskLevel) -> RiskLevel:
        if value in {"low", "moderate", "high", "critical"}:
            return value  # type: ignore[return-value]
        return fallback

    @staticmethod
    def _normalize_trend(value: str | None, fallback: TrendDirection) -> TrendDirection:
        if value in {"rising", "falling", "stable"}:
            return value  # type: ignore[return-value]
        return fallback

    @staticmethod
    def _ensure_list_of_strings(value: object, fallback: list[str]) -> list[str]:
        if not isinstance(value, list):
            return fallback
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return cleaned if cleaned else fallback

    @staticmethod
    def _format_feature_driver(
        name: str, importance: float, signals: StructuredSignals
    ) -> str:
        """Build a human-readable key-driver string from a SHAP feature entry."""
        pct = importance * 100
        label = _FEATURE_LABELS.get(name, name.replace("_", " ").title())

        if name == "rainfall_mm_7d" and signals.rainfall_mm_7d is not None:
            return (
                f"{label} ({signals.rainfall_mm_7d:.0f} mm) contributes {pct:.0f}% "
                f"of the model's predicted risk score"
            )
        if name == "temperature_c_7d" and signals.temperature_c_7d is not None:
            return (
                f"{label} ({signals.temperature_c_7d:.1f} \u00b0C) contributes {pct:.0f}% "
                f"of the model's predicted risk score"
            )
        if name == "wow_case_change_pct" and signals.wow_case_change_pct is not None:
            sign = "+" if signals.wow_case_change_pct >= 0 else ""
            return (
                f"{label} ({sign}{signals.wow_case_change_pct:.1f}%) contributes {pct:.0f}% "
                f"of the model's predicted risk score"
            )
        if name == "recent_case_count":
            return (
                f"{label} ({signals.recent_case_count} cases/week) contributes {pct:.0f}% "
                f"of the model's predicted risk score"
            )
        if name == "historical_trend" and signals.historical_trend:
            trajectory = " \u2192 ".join(str(c) for c in signals.historical_trend)
            return (
                f"{label} ({trajectory}) contributes {pct:.0f}% "
                f"of the model's predicted risk score"
            )
        return f"{label} contributes {pct:.0f}% of the model's predicted risk score"

    # ── Rule-based fallback ──────────────────────────────────────────

    def _generate_rule_based_insight(
        self,
        payload: ExplainInsightRequest,
        document_references: list[DocumentReference] | None = None,
    ) -> ExplainInsightResponse:
        signals = payload.structured_signals
        risk_level = self._classify_risk(signals.model_risk_score)
        trend = self._derive_trend(signals.historical_trend)
        wow = signals.wow_case_change_pct
        drivers: list[str] = []

        # ── SHAP-based drivers (authoritative when available) ─────────
        if signals.feature_importances:
            sorted_fi = sorted(
                signals.feature_importances.items(), key=lambda x: x[1], reverse=True
            )
            for feature_name, importance in sorted_fi[:5]:
                if importance > 0.01:  # skip negligible contributions
                    drivers.append(
                        self._format_feature_driver(feature_name, importance, signals)
                    )
        else:
            # ── Heuristic fallback (no SHAP data) ────────────────────
            if wow is not None:
                if wow >= 15:
                    drivers.append(
                        f"Significant case surge: reported cases increased by {wow:.1f}% week-over-week, indicating rapid transmission acceleration"
                    )
                elif wow >= 10:
                    drivers.append(
                        f"Cases increased by {wow:.1f}% week-over-week, showing an upward trend"
                    )
                elif wow <= -10:
                    drivers.append(
                        f"Cases decreased by {abs(wow):.1f}% week-over-week, suggesting improving conditions"
                    )

            rain = signals.rainfall_mm_7d
            if rain is not None:
                if rain >= 120:
                    drivers.append(
                        f"Very heavy rainfall ({rain:.0f} mm in 7 days) creating extensive standing water and high Aedes breeding potential"
                    )
                elif rain >= 80:
                    drivers.append(
                        f"High rainfall ({rain:.0f} mm in 7 days) increasing mosquito breeding sites"
                    )

            temp = signals.temperature_c_7d
            if temp is not None and temp >= 28:
                drivers.append(
                    f"Elevated temperature ({temp:.1f} °C) shortening mosquito development cycle and increasing biting frequency"
                )

            if signals.historical_trend:
                trend_str = " \u2192 ".join(str(c) for c in signals.historical_trend)
                drivers.append(f"4-week case trajectory: {trend_str} ({trend})")

        if not drivers:
            drivers.append(
                f"Model risk score of {signals.model_risk_score:.2f} is the primary risk indicator"
            )

        recommendations: list[str] = []
        if risk_level == "critical":
            recommendations.extend([
                "Activate emergency response protocol with rapid response teams in all affected MOH areas",
                "Deploy targeted spatial fogging within 200 m radius of confirmed clusters",
                "Coordinate hospital preparedness: ensure adequate IV fluid, platelet monitoring, and ICU capacity",
                "Initiate case investigation and source identification within 48 hours",
            ])
        elif risk_level == "high":
            recommendations.extend([
                "Prioritize mobile vector control teams for targeted fogging in hotspot neighbourhoods",
                "Intensify active case surveillance with fever clinics in high-incidence areas",
                "Launch community source-reduction drives focusing on stored water containers and construction sites",
            ])
        else:
            recommendations.extend([
                "Maintain routine vector surveillance and larviciding programs",
                "Reinforce community education on eliminating stagnant water sources around households",
            ])
        recommendations.append(
            "Monitor weekly epidemiological trends and reassess risk level at next reporting cycle"
        )

        doc_refs = document_references or []
        if doc_refs:
            caveats = [
                f"Recommendations are informed by {len(doc_refs)} retrieved MoH document(s); "
                "verify against the latest ministry guidelines before field deployment."
            ]
        else:
            caveats = [
                "Analysis based on structured surveillance signals; "
                "no RAG corpus documents were retrieved (configure EXPLAIN_PGVECTOR_URL to enable)."
            ]
        if signals.uncertainty_lower is not None and signals.uncertainty_upper is not None:
            caveats.append(
                f"Model forecast uncertainty range: {signals.uncertainty_lower:.2f} – {signals.uncertainty_upper:.2f}"
            )

        filled = sum([
            signals.wow_case_change_pct is not None,
            signals.rainfall_mm_7d is not None,
            signals.temperature_c_7d is not None,
            len(signals.historical_trend) >= 3,
            signals.uncertainty_lower is not None,
            # SHAP importances present → prediction is fully explainable
            bool(signals.feature_importances),
        ])
        confidence = min(100, 30 + filled * 12)

        wow_arrow = "↑" if (wow or 0) > 0 else "↓" if (wow or 0) < 0 else "→"
        summary = (
            f"{payload.district} is assessed at {risk_level.upper()} risk "
            f"for {payload.prediction_week or 'the current week'} "
            f"with {signals.recent_case_count} reported cases "
            f"({wow_arrow} {abs(wow or 0):.1f}% WoW). "
            f"The case trajectory is {trend}."
        )

        phase = "phase-2-rag" if doc_refs else "phase-1-rule-based"
        plain_refs = [
            f"{r.title} ({r.source})" for r in doc_refs
        ] or payload.rag_context[:3]

        return ExplainInsightResponse(
            district=payload.district,
            risk_level=risk_level,
            summary=summary,
            key_drivers=drivers,
            recommendations=recommendations,
            caveats=caveats,
            references=plain_refs,
            document_references=doc_refs,
            implementation_phase=phase,
            confidence_score=confidence,
            trend_direction=trend,
        )

    # ── Gemini LLM generation ────────────────────────────────────────

    def _generate_with_gemini(
        self,
        payload: ExplainInsightRequest,
        baseline: ExplainInsightResponse,
        document_references: list[DocumentReference] | None = None,
    ) -> ExplainInsightResponse:
        if settings.llm_provider.lower() != "gemini":
            return baseline
        if not settings.gemini_api_key:
            return baseline

        data_block = json.dumps(payload.model_dump(), ensure_ascii=False, indent=2)
        user_prompt = (
            f"Analyze the following dengue surveillance data and return the JSON analysis:\n\n{data_block}"
        )

        # Inject retrieved RAG documents as grounding context
        doc_refs = document_references or []
        if doc_refs:
            rag_block = "\n\n".join(
                f"[{i + 1}] {ref.title} ({ref.source}"
                + (f", {ref.published_date}" if ref.published_date else "")
                + f")\n{ref.excerpt}"
                for i, ref in enumerate(doc_refs)
            )
            user_prompt += (
                f"\n\n## Retrieved MoH Reference Documents\n"
                f"The following documents were retrieved from the Ministry of Health corpus "
                f"as relevant context. Ground your recommendations in these sources where applicable:\n\n"
                f"{rag_block}"
            )

        if payload.user_question:
            user_prompt += (
                f"\n\nThe user also asks: \"{payload.user_question}\"\n"
                "Include a `follow_up_answer` field in your JSON with a concise, "
                "expert answer to this question."
            )

        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=[
                {"role": "user", "parts": [{"text": SYSTEM_PROMPT + "\n\n" + user_prompt}]}
            ],
            config={
                "response_mime_type": "application/json",
                "temperature": settings.default_temperature,
            },
        )

        text = (response.text or "").strip()
        if not text:
            return baseline

        generated = json.loads(text)

        phase = "phase-2-rag-gemini" if doc_refs else "phase-1-gemini"
        plain_refs = [
            f"{r.title} ({r.source})" for r in doc_refs
        ] or payload.rag_context[:3]

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
            references=plain_refs,
            document_references=doc_refs,
            implementation_phase=phase,
            confidence_score=max(
                0, min(100, int(generated.get("confidence_score", baseline.confidence_score)))
            ),
            trend_direction=self._normalize_trend(
                generated.get("trend_direction"), baseline.trend_direction
            ),
            follow_up_answer=(
                str(generated["follow_up_answer"]) if "follow_up_answer" in generated else None
            ),
        )

    # ── Public entry point ───────────────────────────────────────────

    def generate_insight(
        self,
        payload: ExplainInsightRequest,
        rag_service: RAGService | None = None,
    ) -> ExplainInsightResponse:
        # Phase 2: retrieve relevant MoH documents before generating the insight
        doc_refs: list[DocumentReference] = []
        if rag_service and rag_service.is_ready:
            sig = payload.structured_signals
            doc_refs = rag_service.retrieve(
                district=payload.district,
                model_risk_score=sig.model_risk_score,
                rainfall_mm_7d=sig.rainfall_mm_7d,
                temperature_c_7d=sig.temperature_c_7d,
                wow_case_change_pct=sig.wow_case_change_pct,
            )

        baseline = self._generate_rule_based_insight(payload, doc_refs)
        try:
            return self._generate_with_gemini(payload, baseline, doc_refs)
        except Exception:
            return baseline


# ══════════════════════════════════════════════════════════════════════
# Phase 3: Gemini-native function calling agent
# ══════════════════════════════════════════════════════════════════════

AGENT_SYSTEM_PROMPT = """\
You are the **EpiLink AI Analyst**, a senior epidemiologist and data \
scientist specialising in dengue fever surveillance for Sri Lanka's \
Ministry of Health.

## Epidemiological Context — Sri Lanka
- **Transmission seasons**: southwest monsoon (May–Sep) affects western, \
southern, and central provinces; northeast monsoon (Oct–Jan) affects \
eastern and northern provinces.
- **Vector biology**: Aedes aegypti breeds in clean standing water; larval \
development accelerates above 28 °C. Extrinsic incubation period is \
8–12 days at 28–32 °C.
- **Alert thresholds**: WoW increase ≥ 15 % = early warning; current cases \
≥ 2× 4-week average = outbreak alert; ≥ 100 cases/week = high-burden district.
- **Key risk provinces**: Colombo, Gampaha, Kalutara, Kandy, and Ratnapura \
historically account for the majority of national cases.

## Available Analytics Tools
- **compare_districts**: Side-by-side latest cases, WoW%, 4-week avg, and \
risk level for multiple districts. Pass an empty string to compare all.
- **year_over_year**: 12-week timeseries with WoW changes, peak detection, \
and momentum for a single district. Use for trend or seasonal questions.
- **get_weather_correlation**: Pearson correlation (temp & rainfall vs \
dengue) per district, with strength classification and ranked insights.
- **get_outbreak_alerts**: Current outbreak/warning alerts with ratio-to-\
average metrics for all flagged districts.
- **get_growth_rate**: Avg growth rate per district over N weeks, ranked \
fastest-growing first, with accelerating/stable/declining counts.
- **get_district_details**: Comprehensive single-district snapshot — latest \
cases, WoW, 8-week history, peak, weather, and risk level. Use first when \
answering detailed questions about one specific district.
- **get_seasonal_pattern**: Multi-year week-by-week seasonal overlay showing \
peak season windows, current vs baseline comparison for a district.
- **get_cross_district_spillover**: Geographic spillover risk — focal district \
plus all neighbouring districts, simultaneous-rise detection.
- **get_intervention_history**: Inferred past intervention response events \
from post-peak case declines (≥30% drops) in the timeseries.
- **get_model_performance_metrics**: ML prediction accuracy — predicted vs \
actual cases, absolute/percentage error, naive-persistence MAE benchmark.
- **get_demographic_hotspots**: Sub-district zone risk breakdown with \
intervention priority ranking by settlement type (urban/coastal/rural).

## Analytical Methodology
1. **Identify the question type** — single-district detail, multi-district \
comparison, trend/seasonal, weather impact, alert status, or geographic spread.
2. **Call the right tool(s)** — always fetch live data before answering; \
never guess statistics.
3. **Analyse the data** — identify trends, anomalies, ratios, thresholds.
4. **Quantify every finding** — "cases rose 23 % from 145 to 178", not \
"cases increased".
5. **Recommend action** — end with 1–2 specific, evidence-based public \
health actions.

## Tool Selection Guide
| Question type | Primary tool | Secondary tool |
|---|---|---|
| Current status for one district | get_district_details | year_over_year |
| Compare two or more districts | compare_districts | get_growth_rate |
| Weather / climate impact | get_weather_correlation | get_district_details |
| Active outbreaks | get_outbreak_alerts | compare_districts |
| Fastest growing / accelerating | get_growth_rate | compare_districts |
| Historical trend / seasonal | year_over_year | get_seasonal_pattern |
| Seasonal peak timing | get_seasonal_pattern | year_over_year |
| Spread to neighbours | get_cross_district_spillover | compare_districts |
| Past interventions / control | get_intervention_history | year_over_year |
| Model prediction accuracy | get_model_performance_metrics | get_district_details |
| Sub-district zone targeting | get_demographic_hotspots | get_district_details |

## Response Format
- **Lead with the key finding** — state the single most important insight first.
- **Use specific numbers** — ratios, percentages, absolute counts from tool results.
- **Structure with markdown** — bold key terms, use bullet lists for \
multiple items.
- **2–4 paragraphs** — concise; do not pad with disclaimers or repetition.
- **End with action** — at least one concrete public health recommendation.
- Do NOT disclaim being an AI or hedge with "I think / I believe".
"""

# ── Gemini function declarations for all 11 tools ────────────────────

def _build_gemini_tools():
    """Build Gemini FunctionDeclaration list for all analytics tools."""
    from google.genai import types as _t

    district_param = _t.Schema(
        type=_t.Type.STRING,
        description="Name of the Sri Lanka district, e.g. 'Colombo'.",
    )

    return _t.Tool(
        function_declarations=[
            _t.FunctionDeclaration(
                name="compare_districts",
                description=(
                    "Compare dengue statistics across multiple districts. "
                    "Returns latest cases, WoW change, 4-week average, and risk level per district."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "districts": _t.Schema(
                            type=_t.Type.STRING,
                            description=(
                                "Comma-separated district names, e.g. 'Colombo,Gampaha,Kandy'. "
                                "Pass an empty string '' to compare all districts."
                            ),
                        )
                    },
                    required=["districts"],
                ),
            ),
            _t.FunctionDeclaration(
                name="year_over_year",
                description=(
                    "Get 12-week timeseries with WoW changes, peak detection, and momentum "
                    "for a single district. Use for trend, historical, or seasonal questions."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={"district": district_param},
                    required=["district"],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_weather_correlation",
                description=(
                    "Pearson correlation between weather variables (temperature, rainfall) "
                    "and dengue cases across all districts, ranked by correlation strength."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={},
                ),
            ),
            _t.FunctionDeclaration(
                name="get_outbreak_alerts",
                description=(
                    "Current outbreak/warning alert status for all districts. "
                    "Returns ratio-to-4-week-average metrics and alert severity."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={},
                ),
            ),
            _t.FunctionDeclaration(
                name="get_growth_rate",
                description=(
                    "Average case growth rate per district over N weeks, "
                    "ranked fastest-growing first, with accelerating/stable/declining counts."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "weeks": _t.Schema(
                            type=_t.Type.INTEGER,
                            description="Number of weeks to compute growth over (default: 4).",
                        )
                    },
                ),
            ),
            _t.FunctionDeclaration(
                name="get_district_details",
                description=(
                    "Comprehensive single-district snapshot: latest cases, WoW change, "
                    "8-week history, peak, weather context, and risk level."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={"district": district_param},
                    required=["district"],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_seasonal_pattern",
                description=(
                    "Multi-year week-by-week seasonal overlay: identifies peak season windows, "
                    "current week vs historical baseline, and whether district is in peak season."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "district": district_param,
                        "years": _t.Schema(
                            type=_t.Type.INTEGER,
                            description="Number of past years to overlay (default: 3, max: 10).",
                        ),
                    },
                    required=["district"],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_cross_district_spillover",
                description=(
                    "Geographic spillover risk for a focal district: fetches the focal district "
                    "plus all its land-border neighbours, detects simultaneous rises, "
                    "and classifies spillover risk as low/moderate/high."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={"district": district_param},
                    required=["district"],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_intervention_history",
                description=(
                    "Infers past vector-control intervention response events from the timeseries: "
                    "identifies peaks ≥25 cases followed by ≥30% case decline within 6 weeks."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={"district": district_param},
                    required=["district"],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_model_performance_metrics",
                description=(
                    "Evaluates ML prediction accuracy for a district: compares the latest "
                    "ML-predicted case count against actual reported cases and computes "
                    "absolute error, percentage error, accuracy class, and naive-persistence MAE."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={"district": district_param},
                    required=["district"],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_demographic_hotspots",
                description=(
                    "Sub-district zone risk breakdown using MOH divisional classification. "
                    "Distributes district case load across urban/coastal/rural zones with "
                    "intervention priority ranking and weather-adjusted context flags."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={"district": district_param},
                    required=["district"],
                ),
            ),
        ]
    )


# Map function names to actual callables
def _build_tool_map():
    from explain_analytics.services.tools import (
        compare_districts,
        get_cross_district_spillover,
        get_demographic_hotspots,
        get_district_details,
        get_growth_rate,
        get_intervention_history,
        get_model_performance_metrics,
        get_outbreak_alerts,
        get_seasonal_pattern,
        get_weather_correlation,
        year_over_year,
    )
    return {
        "compare_districts": compare_districts,
        "year_over_year": year_over_year,
        "get_weather_correlation": get_weather_correlation,
        "get_outbreak_alerts": get_outbreak_alerts,
        "get_growth_rate": get_growth_rate,
        "get_district_details": get_district_details,
        "get_seasonal_pattern": get_seasonal_pattern,
        "get_cross_district_spillover": get_cross_district_spillover,
        "get_intervention_history": get_intervention_history,
        "get_model_performance_metrics": get_model_performance_metrics,
        "get_demographic_hotspots": get_demographic_hotspots,
    }


class AgenticInsightService:
    """Phase 3 service: Gemini-native function calling agent."""

    _MAX_TOOL_ROUNDS = 5  # prevent runaway loops

    def __init__(self) -> None:
        self._tool_map: dict = {}
        self._gemini_tool = None
        self._ready = False
        self._init()

    def _init(self) -> None:
        if not settings.gemini_api_key:
            print("[AgenticInsightService] EXPLAIN_GEMINI_API_KEY not set — agent disabled.")
            return
        try:
            self._tool_map = _build_tool_map()
            self._gemini_tool = _build_gemini_tools()
            self._ready = True
        except Exception as e:
            print(f"[AgenticInsightService] Init failed: {e}")

    @staticmethod
    def _format_signals_context(signals: dict) -> str:
        parts: list[str] = []
        cc = signals.get("recent_case_count")
        if cc is not None:
            parts.append(f"{cc} cases this week")
        wow = signals.get("wow_case_change_pct")
        if wow is not None:
            sign = "+" if wow >= 0 else ""
            parts.append(f"WoW change: {sign}{wow:.1f}%")
        rain = signals.get("rainfall_mm_7d")
        if rain is not None:
            parts.append(f"rainfall: {rain:.0f} mm/7d")
        temp = signals.get("temperature_c_7d")
        if temp is not None:
            parts.append(f"temperature: {temp:.1f} °C")
        risk = signals.get("model_risk_score")
        if risk is not None:
            parts.append(f"model risk score: {risk:.2f}")
        trend = signals.get("historical_trend", [])
        if trend:
            parts.append(f"4-week trend: {' → '.join(str(c) for c in trend)}")
        fi = signals.get("feature_importances")
        if fi and isinstance(fi, dict):
            top = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:3]
            fi_str = ", ".join(
                f"{_FEATURE_LABELS.get(k, k.replace('_', ' ').title())} {v * 100:.0f}%"
                for k, v in top
            )
            parts.append(f"top SHAP drivers: {fi_str}")
        return ", ".join(parts) if parts else "no signals available"

    def _invoke_tool(self, name: str, args: dict) -> str:
        """Execute a tool by name and return its JSON string result."""
        fn = self._tool_map.get(name)
        if fn is None:
            return json.dumps({"error": f"Unknown tool: {name}"})
        try:
            # Tools that take no arguments
            if name in ("get_weather_correlation", "get_outbreak_alerts"):
                return fn()
            return fn(**args)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def chat(
        self,
        district: str,
        messages: list[dict],
        session_id: str,
        structured_signals: dict | None = None,
    ) -> dict:
        import uuid
        from google import genai as _genai
        from google.genai import types as _t

        if not session_id:
            session_id = str(uuid.uuid4())

        # ── Build initial user message ────────────────────────────────
        context_lines = [f"Current district context: {district}"]
        if structured_signals:
            context_lines.append(
                f"Live signals — {self._format_signals_context(structured_signals)}"
            )

        history_parts: list[str] = []
        for msg in messages[:-1]:
            role = msg.get("role", "user")
            content = msg.get("content", "").strip()
            if content:
                history_parts.append(f"{'User' if role == 'user' else 'Assistant'}: {content}")

        last_question = messages[-1]["content"].strip() if messages else ""

        user_text = "\n".join(context_lines)
        if history_parts:
            user_text += "\n\nConversation history:\n" + "\n".join(history_parts)
        user_text += f"\n\nQuestion: {last_question}"

        if not self._ready or not settings.gemini_api_key:
            return {
                "reply": "Agent mode is unavailable. Please configure EXPLAIN_GEMINI_API_KEY.",
                "tool_calls_used": [],
                "session_id": session_id,
            }

        try:
            client = _genai.Client(api_key=settings.gemini_api_key)
            config = _t.GenerateContentConfig(
                tools=[self._gemini_tool],
                system_instruction=AGENT_SYSTEM_PROMPT,
                temperature=settings.default_temperature,
            )

            # Multi-turn contents list — grows with each tool round
            contents: list = [
                _t.Content(role="user", parts=[_t.Part(text=user_text)])
            ]

            tool_calls_used: list[str] = []

            # ── Agentic tool-calling loop ─────────────────────────────
            for _ in range(self._MAX_TOOL_ROUNDS):
                response = client.models.generate_content(
                    model=settings.llm_model,
                    contents=contents,
                    config=config,
                )

                # Collect function calls from response
                function_calls = response.function_calls or []
                if not function_calls:
                    # No more tool calls — final answer
                    break

                # Append model's turn (contains function_call parts)
                contents.append(response.candidates[0].content)

                # Execute each tool and collect responses
                tool_response_parts: list[_t.Part] = []
                for fc in function_calls:
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}
                    if tool_name not in tool_calls_used:
                        tool_calls_used.append(tool_name)
                    print(f"[AgenticInsightService] Tool call: {tool_name}({tool_args})")

                    result_str = self._invoke_tool(tool_name, tool_args)
                    tool_response_parts.append(
                        _t.Part(
                            function_response=_t.FunctionResponse(
                                id=getattr(fc, "id", tool_name),
                                name=tool_name,
                                response={"result": result_str},
                            )
                        )
                    )

                # Append tool results as a user turn
                contents.append(
                    _t.Content(role="user", parts=tool_response_parts)
                )

            # Extract final text response
            reply = (response.text or "").strip()
            if not reply:
                reply = "I was unable to generate a response. Please try again."

            return {
                "reply": reply,
                "tool_calls_used": tool_calls_used,
                "session_id": session_id,
            }

        except Exception as e:
            print(f"[AgenticInsightService] Error: {e}")
            return {
                "reply": f"An error occurred while processing your request: {e}",
                "tool_calls_used": [],
                "session_id": session_id,
            }
