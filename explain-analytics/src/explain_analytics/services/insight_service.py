import json

from google import genai

from explain_analytics.config import settings
from explain_analytics.models import (
    ExplainInsightRequest,
    ExplainInsightResponse,
    RiskLevel,
    TrendDirection,
)

SYSTEM_PROMPT = """\
You are a **Senior Epidemiologist** specializing in dengue fever analytics \
for the Sri Lankan Ministry of Health, integrated into the EpiLink Decision \
Support System.

Your task: given structured surveillance signals for a single district, \
produce a concise but insightful JSON analysis that a Medical Officer of \
Health (MOH) can immediately act upon.

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
recommendations tailored to the risk level and drivers, e.g. fogging, \
source reduction, hospital bed allocation"],
  "caveats": ["1–3 short caveats about model limitations or data gaps"],
  "confidence_score": 0-100,
  "trend_direction": "rising | falling | stable"
}

## Guidelines
- Be specific to dengue in Sri Lanka; reference tropical weather patterns.
- If rainfall > 80 mm / 7 days, highlight vector breeding risk.
- If WoW change > 15%, emphasize the acceleration.
- Derive trend_direction from the historical_trend array: compare recent \
weeks to detect rising/falling/stable patterns.
- confidence_score should reflect data completeness (all signals present → \
higher) and consistency of trend signals.
- Keep each string concise (max 2 sentences per bullet).
- Do NOT include any markdown, only valid JSON.
"""


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

    # ── Rule-based fallback ──────────────────────────────────────────

    def _generate_rule_based_insight(
        self, payload: ExplainInsightRequest
    ) -> ExplainInsightResponse:
        signals = payload.structured_signals
        risk_level = self._classify_risk(signals.model_risk_score)
        trend = self._derive_trend(signals.historical_trend)
        drivers: list[str] = []

        wow = signals.wow_case_change_pct
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
                f"Elevated temperature ({temp:.1f}°C) shortening mosquito development cycle and increasing biting frequency"
            )

        if signals.historical_trend:
            trend_str = " → ".join(str(c) for c in signals.historical_trend)
            drivers.append(f"4-week case trajectory: {trend_str} ({trend})")

        if not drivers:
            drivers.append(
                f"Model risk score of {signals.model_risk_score:.2f} is the primary risk indicator"
            )

        recommendations = []
        if risk_level in ("critical",):
            recommendations.extend([
                "Activate emergency response protocol with rapid response teams in all affected MOH areas",
                "Deploy targeted spatial fogging within 200m radius of confirmed clusters",
                "Coordinate hospital preparedness: ensure adequate IV fluid, platelet monitoring, and ICU capacity",
            ])
        elif risk_level == "high":
            recommendations.extend([
                "Prioritize mobile vector control teams for targeted fogging in hotspot neighborhoods",
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

        caveats = [
            "Analysis based on structured surveillance signals (Phase 1); historical document retrieval (RAG) not yet active"
        ]
        if signals.uncertainty_lower is not None and signals.uncertainty_upper is not None:
            caveats.append(
                f"Model forecast uncertainty range: {signals.uncertainty_lower:.2f} – {signals.uncertainty_upper:.2f}"
            )

        # Confidence score
        filled = sum([
            signals.wow_case_change_pct is not None,
            signals.rainfall_mm_7d is not None,
            signals.temperature_c_7d is not None,
            len(signals.historical_trend) >= 3,
            signals.uncertainty_lower is not None,
        ])
        confidence = min(100, 30 + filled * 14)

        summary = (
            f"{payload.district} is assessed at **{risk_level}** risk for {payload.prediction_week or 'the current week'} "
            f"with {signals.recent_case_count} reported cases "
            f"({'↑' if (wow or 0) > 0 else '↓' if (wow or 0) < 0 else '→'} {abs(wow or 0):.1f}% WoW). "
            f"The case trajectory is {trend}."
        )

        return ExplainInsightResponse(
            district=payload.district,
            risk_level=risk_level,
            summary=summary,
            key_drivers=drivers,
            recommendations=recommendations,
            caveats=caveats,
            references=payload.rag_context[:3],
            implementation_phase="phase-1-rule-based",
            confidence_score=confidence,
            trend_direction=trend,
        )

    # ── Gemini LLM generation ────────────────────────────────────────

    def _generate_with_gemini(
        self, payload: ExplainInsightRequest, baseline: ExplainInsightResponse
    ) -> ExplainInsightResponse:
        if settings.llm_provider.lower() != "gemini":
            return baseline
        if not settings.gemini_api_key:
            return baseline

        # Build a rich data block for the LLM
        data_block = json.dumps(payload.model_dump(), ensure_ascii=False, indent=2)

        user_prompt = f"Analyze the following dengue surveillance data and return the JSON analysis:\n\n{data_block}"

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
            implementation_phase="phase-1-gemini",
            confidence_score=max(0, min(100, int(generated.get("confidence_score", baseline.confidence_score)))),
            trend_direction=self._normalize_trend(
                generated.get("trend_direction"), baseline.trend_direction
            ),
            follow_up_answer=str(generated["follow_up_answer"]) if "follow_up_answer" in generated else None,
        )

    # ── Public entry point ───────────────────────────────────────────

    def generate_insight(
        self, payload: ExplainInsightRequest
    ) -> ExplainInsightResponse:
        baseline = self._generate_rule_based_insight(payload)
        try:
            return self._generate_with_gemini(payload, baseline)
        except Exception:
            return baseline


# ══════════════════════════════════════════════════════════════════════
# Phase 3: Agno-powered agentic chat
# ══════════════════════════════════════════════════════════════════════

AGENT_SYSTEM_PROMPT = """\
You are the **EpiLink AI Analyst**, an expert public health epidemiologist \
specializing in dengue fever surveillance for Sri Lanka's Ministry of Health.

You have access to live analytics tools that can query real-time data from \
the EpiLink system. Use them proactively when answering questions:

- **compare_districts**: Compare dengue stats across multiple districts
- **year_over_year**: Get historical timeseries for a district
- **get_weather_correlation**: Analyze weather-dengue relationships
- **get_outbreak_alerts**: Check current outbreak alert status
- **get_growth_rate**: Analyze case growth acceleration

## Communication Style
- Be concise but thorough — prioritize actionable intelligence
- Lead with the most critical finding
- Use specific numbers from tool results, not vague statements
- When comparing, use relative terms ("2.3× higher", "down 18%")
- End with 1–2 concrete, actionable recommendations when appropriate
- If data is insufficient, state what's missing and what to monitor

## Context
You are chatting with a Medical Officer of Health (MOH) or district-level \
public health administrator. They need quick, evidence-based answers to \
make resource allocation and intervention decisions.
"""


class AgenticInsightService:
    """Phase 3 service: Agno Agent with tools for interactive chat."""

    def __init__(self) -> None:
        self._sessions: dict[str, list[dict]] = {}
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
                    "Always use tools when the user asks about comparisons, historical data, weather, or outbreaks.",
                    "Use specific numbers and percentages from tool results.",
                    "Be concise — 2-4 paragraphs max for complex answers.",
                ],
                markdown=True,
                show_tool_calls=True,
            )
        except Exception as e:
            print(f"[AgenticInsightService] Failed to init Agno agent: {e}")
            self._agent = None

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

        # Build the user message with context
        last_msg = messages[-1]["content"] if messages else ""

        context_prefix = f"[District context: {district}]"
        if structured_signals:
            context_prefix += (
                f" [Cases: {structured_signals.get('recent_case_count', '?')}, "
                f"WoW: {structured_signals.get('wow_case_change_pct', '?')}%, "
                f"Rainfall: {structured_signals.get('rainfall_mm_7d', '?')}mm]"
            )

        full_prompt = f"{context_prefix}\n\nUser question: {last_msg}"

        tool_calls_used: list[str] = []

        if self._agent is not None:
            try:
                response = self._agent.run(full_prompt)
                reply = response.content or "I couldn't generate a response."

                # Extract tool call names from response
                if hasattr(response, "messages"):
                    for msg in response.messages:
                        if hasattr(msg, "tool_calls") and msg.tool_calls:
                            for tc in msg.tool_calls:
                                fname = getattr(tc, "function", None)
                                if fname and hasattr(fname, "name"):
                                    tool_calls_used.append(fname.name)

                return {
                    "reply": reply,
                    "tool_calls_used": tool_calls_used,
                    "session_id": session_id,
                }
            except Exception as e:
                print(f"[AgenticInsightService] Agent error: {e}")

        # Fallback: direct Gemini call without tools
        if settings.gemini_api_key:
            try:
                from google import genai

                client = genai.Client(api_key=settings.gemini_api_key)
                resp = client.models.generate_content(
                    model=settings.llm_model,
                    contents=[
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "text": AGENT_SYSTEM_PROMPT
                                    + "\n\n"
                                    + full_prompt
                                }
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

