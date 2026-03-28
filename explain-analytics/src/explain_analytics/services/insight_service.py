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
# Phase 3: Agno-powered agentic chat
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

## Analytical Methodology
1. **Identify the question type** — single-district detail, multi-district \
comparison, trend/seasonal, weather impact, or alert status.
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
| Historical trend / seasonal | year_over_year | compare_districts |

## Response Format
- **Lead with the key finding** — state the single most important insight first.
- **Use specific numbers** — ratios, percentages, absolute counts.
- **Structure with markdown** — bold key terms, use bullet lists for \
multiple items.
- **2–4 paragraphs** — concise; do not pad with disclaimers or repetition.
- **End with action** — at least one concrete public health recommendation.
- Do NOT disclaim being an AI or hedge with "I think / I believe".
"""


class AgenticInsightService:
    """Phase 3 service: Agno Agent with tools for interactive chat."""

    def __init__(self) -> None:
        self._agent = None
        self._init_agent()

    def _init_agent(self) -> None:
        if not settings.enable_agent_mode:
            return
        if not settings.gemini_api_key:
            return

        try:
            from agno.agent import Agent
            from agno.models.google import Gemini
            from explain_analytics.services.tools import ALL_TOOLS

            self._agent = Agent(
                model=Gemini(
                    id=settings.llm_model,
                    api_key=settings.gemini_api_key,
                ),
                tools=ALL_TOOLS,
                description=AGENT_SYSTEM_PROMPT,
                instructions=[
                    "ALWAYS call tools before answering any data question — never guess statistics.",
                    "For single-district questions, call get_district_details first.",
                    "For comparison questions, call compare_districts with the relevant districts.",
                    "For trend/historical questions, call year_over_year.",
                    "For weather impact, call get_weather_correlation.",
                    "Use specific numbers from tool results: percentages, ratios, absolute counts.",
                    "Keep responses to 2–4 concise paragraphs with one concrete recommendation.",
                ],
                markdown=True,
                show_tool_calls=False,
            )
        except Exception as e:
            print(f"[AgenticInsightService] Failed to init Agno agent: {e}")
            self._agent = None

    @staticmethod
    def _clean_response(text: str) -> str:
        """Strip residual tool_code / tool_result fenced blocks from agent output."""
        import re

        text = re.sub(r"```tool_code\s*\n.*?```", "", text, flags=re.DOTALL)
        text = re.sub(r"```tool_result\s*\n.*?```", "", text, flags=re.DOTALL)
        text = re.sub(
            r"```\w*\s*\n\s*\w+\(.*?\)\s*\n\s*```", "", text, flags=re.DOTALL
        )
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def _format_signals_context(signals: dict) -> str:
        """Format structured signals into a readable context string."""
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

        unc_l = signals.get("uncertainty_lower")
        unc_u = signals.get("uncertainty_upper")
        if unc_l is not None and unc_u is not None:
            parts.append(f"uncertainty band: {unc_l:.2f}–{unc_u:.2f}")

        fi = signals.get("feature_importances")
        if fi and isinstance(fi, dict):
            top = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:3]
            fi_str = ", ".join(
                f"{_FEATURE_LABELS.get(k, k.replace('_', ' ').title())} {v * 100:.0f}%"
                for k, v in top
            )
            parts.append(f"top SHAP drivers: {fi_str}")

        return ", ".join(parts) if parts else "no signals available"

    @staticmethod
    def _extract_tool_calls(response: object) -> list[str]:
        """Robustly extract tool call names from an Agno RunResponse."""
        tool_calls: list[str] = []
        messages = getattr(response, "messages", None) or []
        for msg in messages:
            # Method 1: tool_calls attribute with function.name
            tcs = getattr(msg, "tool_calls", None) or []
            for tc in tcs:
                fn = getattr(tc, "function", None)
                name = getattr(fn, "name", None) if fn else None
                if name and name not in tool_calls:
                    tool_calls.append(name)

            # Method 2: role == "tool" or "function" with a name attribute
            role = getattr(msg, "role", "")
            if role in ("tool", "function"):
                name = getattr(msg, "name", None) or getattr(msg, "tool_name", None)
                if name and name not in tool_calls:
                    tool_calls.append(name)

            # Method 3: tool_name directly on the message (some Agno versions)
            tool_name = getattr(msg, "tool_name", None)
            if tool_name and tool_name not in tool_calls:
                tool_calls.append(tool_name)

        return tool_calls

    def chat(
        self,
        district: str,
        messages: list[dict],
        session_id: str,
        structured_signals: dict | None = None,
    ) -> dict:
        import uuid

        if not session_id:
            session_id = str(uuid.uuid4())

        # ── Build district context block ──────────────────────────────
        context_lines = [f"**Current district context: {district}**"]
        if structured_signals:
            context_lines.append(
                f"Live signals — {self._format_signals_context(structured_signals)}"
            )
        context_block = "\n".join(context_lines)

        # ── Include conversation history (all messages except the last) ──
        history_block = ""
        if len(messages) > 1:
            history_lines: list[str] = []
            for msg in messages[:-1]:
                role = msg.get("role", "user")
                content = msg.get("content", "").strip()
                if content:
                    prefix = "User" if role == "user" else "Assistant"
                    history_lines.append(f"{prefix}: {content}")
            if history_lines:
                history_block = (
                    "\n\n**Conversation history (for context):**\n"
                    + "\n".join(history_lines)
                )

        # ── Current user question ─────────────────────────────────────
        last_msg = messages[-1]["content"].strip() if messages else ""
        full_prompt = f"{context_block}{history_block}\n\n**Question:** {last_msg}"

        # ── Agent path ────────────────────────────────────────────────
        if self._agent is not None:
            try:
                response = self._agent.run(full_prompt)
                reply = self._clean_response(
                    response.content or "I couldn't generate a response."
                )
                tool_calls_used = self._extract_tool_calls(response)

                return {
                    "reply": reply,
                    "tool_calls_used": tool_calls_used,
                    "session_id": session_id,
                }
            except Exception as e:
                print(f"[AgenticInsightService] Agent error: {e}")

        # ── Fallback: direct Gemini call without tools ────────────────
        if settings.gemini_api_key:
            try:
                from google import genai as _genai

                client = _genai.Client(api_key=settings.gemini_api_key)
                resp = client.models.generate_content(
                    model=settings.llm_model,
                    contents=[
                        {
                            "role": "user",
                            "parts": [
                                {"text": AGENT_SYSTEM_PROMPT + "\n\n" + full_prompt}
                            ],
                        }
                    ],
                    config={"temperature": settings.default_temperature},
                )
                return {
                    "reply": resp.text or "No response generated.",
                    "tool_calls_used": [],
                    "session_id": session_id,
                }
            except Exception as e:
                return {
                    "reply": f"AI service error: {e}",
                    "tool_calls_used": [],
                    "session_id": session_id,
                }

        return {
            "reply": "Agent mode is not available. Please configure EXPLAIN_GEMINI_API_KEY.",
            "tool_calls_used": [],
            "session_id": session_id,
        }
