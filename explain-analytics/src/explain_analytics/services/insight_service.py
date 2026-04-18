import json
from datetime import datetime, timezone, timedelta

from google import genai

from explain_analytics.config import settings
from explain_analytics.models import (
    DistrictSignal,
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

## Spatial / Geographic Cluster Context
- `structured_signals.neighboring_districts` contains snapshots for all \
land-border adjacent districts. When present, consider them in your analysis.
- If 3 or more neighbouring districts are simultaneously rising (WoW ≥ 15%), \
flag a geographic cluster in `key_drivers`: "Geographic cluster: X \
neighbouring districts rising simultaneously, indicating regional spread."
- If any neighbour has `model_risk_score ≥ 0.65`, note the high-burden \
neighbour as a spillover source/destination risk.
- When spillover indicators are present, include an inter-district \
coordination recommendation (e.g., joint vector control, shared surveillance).

## Confidence and Uncertainty (Enhancement 6)
- `structured_signals.uncertainty_lower` and `uncertainty_upper` are the \
model's 80 % confidence interval for the predicted risk score (0–1 scale). \
When present, surface this in the `summary` field:
  "The model predicts [risk_level] risk with an 80% interval of \
[lower]–[upper], indicating [low/moderate/high] uncertainty."
- A narrow interval (< 0.10) means the ensemble is confident; a wide \
interval (> 0.30) means high model uncertainty that warrants caution.
- `confidence_score` should reflect both data completeness AND model \
certainty: start from the completeness base (30 + 12 per filled signal) \
and adjust downward when the uncertainty interval is wide (> 0.25).

## Guidelines
- Be specific to dengue in Sri Lanka; reference tropical weather patterns.
- If rainfall > 80 mm / 7 days, highlight vector breeding risk explicitly.
- If WoW change > 15 %, emphasize the acceleration and early-warning status.
- Derive trend_direction from the historical_trend array: compare recent \
weeks to detect rising/falling/stable patterns.
- Presence of feature_importances indicates a fully explainable prediction \
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

    # ── Spatial cluster detection (Enhancement 5) ───────────────────

    @staticmethod
    def _detect_spillover(
        neighbors: list[DistrictSignal],
    ) -> tuple[bool, list[str]]:
        """Analyse neighbouring district signals for geographic cluster spread.

        Returns:
            (spillover_risk, extra_key_drivers)
            spillover_risk  — True when a high-burden neighbour exists OR
                              3+ neighbours are simultaneously rising.
            extra_key_drivers — Strings ready to append to key_drivers.
        """
        if not neighbors:
            return False, []

        rising = [
            n for n in neighbors if (n.wow_case_change_pct or 0) >= 15
        ]
        high_burden = [
            n for n in neighbors if n.model_risk_score >= 0.65
        ]

        drivers: list[str] = []
        spillover = False

        if len(rising) >= 3:
            names = ", ".join(n.district for n in rising[:5])
            drivers.append(
                f"Geographic cluster detected: {len(rising)} neighbouring districts "
                f"({names}) are simultaneously rising (≥15% WoW), indicating "
                f"regional spread rather than isolated local transmission"
            )
            spillover = True

        if high_burden:
            names = ", ".join(
                f"{n.district} (risk score {n.model_risk_score:.2f})"
                for n in sorted(high_burden, key=lambda x: x.model_risk_score, reverse=True)[:3]
            )
            drivers.append(
                f"High-burden neighbouring district(s) detected: {names} — "
                f"cross-district vector movement or shared breeding sites possible"
            )
            spillover = True

        # Softer signal: 1–2 rising neighbours worth noting but not flagging
        if not spillover and 1 <= len(rising) < 3:
            names = ", ".join(n.district for n in rising)
            drivers.append(
                f"{len(rising)} adjacent district(s) also rising ({names}); "
                f"monitor for cluster formation"
            )

        return spillover, drivers

    # ── Enhancement 6: confidence / uncertainty helpers ─────────────

    @staticmethod
    def _compute_data_completeness(signals: StructuredSignals) -> int:
        """Signal-completeness score (0–100): 30 base + 12 pts per filled field."""
        filled = sum([
            signals.wow_case_change_pct is not None,
            signals.rainfall_mm_7d is not None,
            signals.temperature_c_7d is not None,
            len(signals.historical_trend) >= 3,
            signals.uncertainty_lower is not None,
            bool(signals.feature_importances),
        ])
        return min(100, 30 + filled * 12)

    @staticmethod
    def _compute_prediction_confidence(signals: StructuredSignals) -> int:
        """Model certainty score (0–100) from the ensemble's uncertainty interval.

        Narrow interval (< 0.05) → ~100; wide interval (> 0.50) → ~0.
        Falls back to 50 when bounds are unavailable.
        """
        lo = signals.uncertainty_lower
        hi = signals.uncertainty_upper
        if lo is None or hi is None:
            return 50
        interval = max(0.0, float(hi) - float(lo))
        # Linear mapping: 0.0 interval → 100, 0.5 interval → 0
        raw = 100.0 * (1.0 - interval / 0.5)
        return max(0, min(100, round(raw)))

    @staticmethod
    def _check_data_freshness(
        prediction_week: str | None,
        data_last_updated: str | None,
    ) -> bool:
        """Return True when the latest data is more than 7 days old."""
        now = datetime.now(timezone.utc)

        # Prefer explicit timestamp if provided by the caller
        if data_last_updated:
            try:
                ts = datetime.fromisoformat(data_last_updated.replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                return (now - ts) > timedelta(days=7)
            except ValueError:
                pass

        # Fall back: parse "YYYY-WWW" or "YYYY-WW" format
        if prediction_week:
            try:
                # Normalise "2026-W12" → "2026-12"
                clean = prediction_week.replace("W", "").replace("-", "")
                # Expect YYYYWW(W) — take first 6 chars
                year = int(clean[:4])
                week = int(clean[4:6])
                # Monday of that ISO week
                jan_4 = datetime(year, 1, 4, tzinfo=timezone.utc)
                week_monday = jan_4 + timedelta(
                    days=-jan_4.weekday(), weeks=week - 1
                )
                return (now - week_monday) > timedelta(days=7)
            except (ValueError, OverflowError):
                pass

        return False

    @staticmethod
    def _build_uncertainty_sentence(signals: StructuredSignals) -> str | None:
        """Build the uncertainty clause for the summary sentence, or None."""
        lo = signals.uncertainty_lower
        hi = signals.uncertainty_upper
        if lo is None or hi is None:
            return None
        interval = float(hi) - float(lo)
        if interval < 0.10:
            certainty = "low uncertainty"
        elif interval < 0.25:
            certainty = "moderate uncertainty"
        else:
            certainty = "high uncertainty"
        return (
            f"The model's 80% confidence interval is {lo:.2f}–{hi:.2f}, "
            f"indicating {certainty}."
        )

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

        # ── Spatial cluster detection ─────────────────────────────────
        spillover_risk, spatial_drivers = self._detect_spillover(
            signals.neighboring_districts
        )
        drivers.extend(spatial_drivers)

        # Add inter-district coordination recommendation when spillover is detected
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
        if spillover_risk:
            recommendations.append(
                "Coordinate inter-district response with adjacent MOH units: share vector control "
                "resources and align surveillance reporting to track geographic spread"
            )
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

        # ── Enhancement 6: compute the three new confidence fields ────
        data_completeness = self._compute_data_completeness(signals)
        pred_confidence = self._compute_prediction_confidence(signals)
        freshness_warning = self._check_data_freshness(
            payload.prediction_week,
            signals.data_last_updated,
        )

        if freshness_warning:
            caveats.append(
                "Data freshness warning: the latest surveillance data is more than "
                "7 days old. Predictions may not reflect the most recent situation."
            )

        # Build summary with uncertainty clause when bounds are available
        wow_arrow = "↑" if (wow or 0) > 0 else "↓" if (wow or 0) < 0 else "→"
        uncertainty_clause = self._build_uncertainty_sentence(signals)
        summary = (
            f"{payload.district} is assessed at {risk_level.upper()} risk "
            f"for {payload.prediction_week or 'the current week'} "
            f"with {signals.recent_case_count} reported cases "
            f"({wow_arrow} {abs(wow or 0):.1f}% WoW). "
            f"The case trajectory is {trend}."
        )
        if uncertainty_clause:
            summary += f" {uncertainty_clause}"

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
            confidence_score=data_completeness,
            data_completeness_score=data_completeness,
            prediction_confidence=pred_confidence,
            data_freshness_warning=freshness_warning,
            trend_direction=trend,
            spillover_risk=spillover_risk,
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

        # LLM may update confidence_score; clamp it and use as data_completeness
        llm_confidence = max(
            0, min(100, int(generated.get("confidence_score", baseline.confidence_score)))
        )

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
            # Enhancement 6: carry all three confidence fields from baseline
            # (LLM gets confidence_score in its schema; map to data_completeness)
            confidence_score=llm_confidence,
            data_completeness_score=llm_confidence,
            prediction_confidence=baseline.prediction_confidence,
            data_freshness_warning=baseline.data_freshness_warning,
            trend_direction=self._normalize_trend(
                generated.get("trend_direction"), baseline.trend_direction
            ),
            spillover_risk=baseline.spillover_risk,
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
                feature_importances=sig.feature_importances or None,
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
- **get_national_briefing**: National-level aggregate — total cases, critical/\
high-risk district counts, top hotspots, national WoW%, trend direction. \
No parameters needed. Use first for country-wide questions.
- **get_weekly_ml_forecast**: ML model's 1-week-ahead case forecast for one or \
all districts — predicted cases, confidence, forecast vs current comparison, \
trend direction. Use for forward-looking / prediction questions.
- **get_rapid_hotspots**: Priority-ranked triage of top N districts by case \
magnitude + trajectory (hotspot score). Use for "where should resources go?" \
or "which districts are worst?". Different from outbreak alerts — ranks by \
absolute burden, not ratio thresholds.
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
- **get_historical_range**: Case data for a custom date range for a district \
(start_year, start_week, end_year, end_week). Use when the user specifies a \
specific time window outside the standard recent weeks.

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
| National/country-wide situation | get_national_briefing | compare_districts |
| ML forecast / predicted cases | get_weekly_ml_forecast | get_district_details |
| Resource deployment / worst districts | get_rapid_hotspots | get_outbreak_alerts |
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
| Specific time window / outbreak period | get_historical_range | year_over_year |

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
            _t.FunctionDeclaration(
                name="get_rapid_hotspots",
                description=(
                    "Identify the top dengue hotspot districts ranked by current case magnitude "
                    "and trajectory. Use for 'where should resources go?', 'which districts are "
                    "worst?', or quick priority triage. Distinct from outbreak alerts — this ranks "
                    "by absolute burden, not ratio thresholds."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "top_n": _t.Schema(
                            type=_t.Type.INTEGER,
                            description="Number of top hotspot districts to return. Default 5, max 10.",
                        ),
                    },
                    required=[],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_weekly_ml_forecast",
                description=(
                    "Get the ML model's 1-week-ahead dengue case forecast for one or all districts. "
                    "Use when the user asks about predicted/forecast cases, what the model expects "
                    "next week, or wants to compare current actuals to the prediction."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "district": _t.Schema(
                            type=_t.Type.STRING,
                            description="District name (e.g. 'Colombo'). Leave empty for all districts.",
                        ),
                    },
                    required=[],
                ),
            ),
            _t.FunctionDeclaration(
                name="get_national_briefing",
                description=(
                    "Get a national-level dengue situation summary across all Sri Lanka districts. "
                    "Use for questions about the overall country situation, total case burden, "
                    "how many districts are high-risk, or a national briefing. No parameters needed."
                ),
                parameters=_t.Schema(type=_t.Type.OBJECT, properties={}, required=[]),
            ),
            _t.FunctionDeclaration(
                name="get_historical_range",
                description=(
                    "Fetch dengue case data for a custom date range for a district. Use when the "
                    "user specifies a specific time window: 'show me June to September 2024', "
                    "'what happened in weeks 20–35', or any question outside the standard recent window."
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "district": _t.Schema(type=_t.Type.STRING, description="District name."),
                        "start_year": _t.Schema(type=_t.Type.INTEGER, description="ISO year of range start."),
                        "start_week": _t.Schema(type=_t.Type.INTEGER, description="ISO week of range start (1–52)."),
                        "end_year": _t.Schema(type=_t.Type.INTEGER, description="ISO year of range end."),
                        "end_week": _t.Schema(type=_t.Type.INTEGER, description="ISO week of range end (1–52)."),
                    },
                    required=["district", "start_year", "start_week", "end_year", "end_week"],
                ),
            ),
            _t.FunctionDeclaration(
                name="search_knowledge_base",
                description=(
                    "Search the dengue knowledge base (Qdrant RAG corpus) for authoritative "
                    "guidelines, clinical protocols, vector control procedures, epidemiological "
                    "references, and general dengue information. Use this tool to answer questions "
                    "about dengue symptoms, treatment, prevention, vector biology, vaccines, "
                    "clinical management, outbreak response protocols, or any topic requiring "
                    "factual dengue knowledge beyond live surveillance data. "
                    "Examples: 'What are dengue warning signs?', 'How is fogging done?', "
                    "'What is the dengue vaccine?', 'How does dengue spread?'"
                ),
                parameters=_t.Schema(
                    type=_t.Type.OBJECT,
                    properties={
                        "query": _t.Schema(
                            type=_t.Type.STRING,
                            description=(
                                "Natural-language question or keyword phrase to search. "
                                "Be specific, e.g. 'dengue warning signs hospitalisation criteria' "
                                "or 'Aedes aegypti larval control temephos'."
                            ),
                        ),
                        "source_type": _t.Schema(
                            type=_t.Type.STRING,
                            description=(
                                "Optional filter: 'knowledge' for guidelines/clinical docs, "
                                "'surveillance' for live case data, 'guideline' for MoH docs. "
                                "Omit to search all document types."
                            ),
                        ),
                    },
                    required=["query"],
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
        get_historical_range,
        get_intervention_history,
        get_model_performance_metrics,
        get_national_briefing,
        get_outbreak_alerts,
        get_rapid_hotspots,
        get_weekly_ml_forecast,
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
        "get_national_briefing": get_national_briefing,
        "get_weekly_ml_forecast": get_weekly_ml_forecast,
        "get_rapid_hotspots": get_rapid_hotspots,
        "get_historical_range": get_historical_range,
    }


class AgenticInsightService:
    """Phase 3 service: Gemini-native function calling agent.

    Enhancement 7: accepts a SessionService instance for Redis-backed
    session persistence.  When Redis is available, clients only need to
    send the new user message + session_id; full history is managed here.
    Falls back to stateless behaviour when Redis is not configured.

    Enhancement RAG: accepts an optional RAGService for corpus-backed knowledge
    retrieval. When provided, a 12th tool (search_knowledge_base) is registered
    and pre-retrieved documents are injected as context before each Gemini call.
    """

    _MAX_TOOL_ROUNDS = 5  # prevent runaway loops

    def __init__(self, session_service=None, rag_service=None) -> None:
        self._tool_map: dict = {}
        self._gemini_tool = None
        self._ready = False
        self._session_svc = session_service  # may be None
        self._rag_service = rag_service  # may be None
        self._init()

    def _init(self) -> None:
        if not settings.gemini_api_key:
            print("[AgenticInsightService] EXPLAIN_GEMINI_API_KEY not set — agent disabled.")
            return
        try:
            self._tool_map = _build_tool_map()
            self._gemini_tool = _build_gemini_tools()
            self._ready = True
            rag_status = "enabled" if (self._rag_service and self._rag_service.is_ready) else "disabled"
            print(f"[AgenticInsightService] Ready. RAG corpus search: {rag_status}.")
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
        # RAG knowledge-base search is handled directly (not in tool_map)
        if name == "search_knowledge_base":
            return self._invoke_knowledge_search(args)

        fn = self._tool_map.get(name)
        if fn is None:
            return json.dumps({"error": f"Unknown tool: {name}"})
        try:
            # Tools that take no arguments
            if name in ("get_weather_correlation", "get_outbreak_alerts", "get_national_briefing"):
                return fn()
            return fn(**args)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def _invoke_knowledge_search(self, args: dict) -> str:
        """Execute a RAG corpus search and return results as a JSON string."""
        if not self._rag_service or not self._rag_service.is_ready:
            return json.dumps({
                "error": "Knowledge base is not available. RAG service not configured.",
                "documents": [],
            })
        query = args.get("query", "")
        source_type = args.get("source_type") or None
        if not query:
            return json.dumps({"error": "query parameter is required.", "documents": []})

        try:
            docs = self._rag_service.retrieve_for_query(
                query=query,
                top_k=settings.rag_top_k,
                source_type=source_type,
            )
            return json.dumps({
                "query": query,
                "document_count": len(docs),
                "documents": [
                    {
                        "title": d.title,
                        "source": d.source,
                        "published_date": d.published_date,
                        "relevance_score": d.relevance_score,
                        "excerpt": d.excerpt,
                    }
                    for d in docs
                ],
            }, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"error": str(exc), "documents": []})

    def chat(
        self,
        district: str,
        new_message: str,
        session_id: str,
        structured_signals: dict | None = None,
    ) -> dict:
        """Process a single new user message.

        Enhancement 7: full conversation history is loaded from and stored in
        Redis (via SessionService).  When Redis is unavailable the method
        operates statelessly — history is not persisted across requests.

        Args:
            district: Active district context.
            new_message: The user's latest question / message text.
            session_id: Redis session key.  A new key is created when empty.
            structured_signals: Optional live surveillance signals dict.

        Returns:
            dict with keys: reply, tool_calls_used, session_id, turn_count,
            context_compressed.
        """
        import uuid
        from google import genai as _genai
        from google.genai import types as _t

        svc = self._session_svc  # may be None

        # ── Session ID management ────────────────────────────────────
        if not session_id:
            session_id = svc.create_session() if svc and svc.is_ready else str(uuid.uuid4())
        elif svc and svc.is_ready and not svc.session_exists(session_id):
            # New session_id provided by client (first message)
            svc.create_session.__func__  # ensure method exists (no-op)
            # Initialise the key so append_messages works
            svc._redis.setex(svc._key(session_id), svc._ttl, "[]")  # noqa: SLF001

        # ── Load history from Redis (or empty for stateless mode) ────
        stored_history: list[dict] = svc.get_messages(session_id) if svc and svc.is_ready else []
        context_compressed = False

        # ── Compress old context if needed ───────────────────────────
        if svc and svc.is_ready and svc.needs_summarization(session_id) and settings.gemini_api_key:
            try:
                from google import genai as _genai_sum
                _gclient = _genai_sum.Client(api_key=settings.gemini_api_key)
                svc.summarize_and_compress(session_id, _gclient, settings.llm_model)
                stored_history = svc.get_messages(session_id)
                context_compressed = True
                print(f"[AgenticInsightService] Session {session_id[:8]}… compressed.")
            except Exception as exc:
                print(f"[AgenticInsightService] Summarisation error: {exc}")

        # ── Build Gemini contents list from stored history ───────────
        # ── Pre-retrieve RAG documents for the user's question ──────────
        rag_docs = []
        if self._rag_service and self._rag_service.is_ready:
            try:
                rag_docs = self._rag_service.retrieve_for_query(
                    query=new_message,
                    top_k=settings.rag_top_k,
                )
                print(f"[AgenticInsightService] Pre-retrieved {len(rag_docs)} RAG docs for query.")
            except Exception as exc:
                print(f"[AgenticInsightService] Pre-retrieval error: {exc}")

        # Build RAG context block to inject into system instruction
        rag_context_block = ""
        if rag_docs:
            rag_context_block = "\n\n## Retrieved Knowledge Base Context\n"
            rag_context_block += (
                "The following documents were retrieved from the dengue knowledge base "
                "as potentially relevant to the user's question. Use them to ground your "
                "answer in authoritative sources. Cite document titles when using their content.\n\n"
            )
            for i, doc in enumerate(rag_docs):
                rag_context_block += (
                    f"[{i + 1}] **{doc.title}** ({doc.source}"
                    + (f", {doc.published_date}" if doc.published_date else "")
                    + f")\n{doc.excerpt}\n\n"
                )

        context_header = (
            f"Current district context: {district}"
            + (
                f"\nLive signals — {self._format_signals_context(structured_signals)}"
                if structured_signals
                else ""
            )
        )

        if not self._ready or not settings.gemini_api_key:
            # Store the unanswered turn if possible
            if svc and svc.is_ready:
                svc.append_messages(session_id, [{"role": "user", "content": new_message}])
            turn_count = len(stored_history) // 2 + 1
            return {
                "reply": "Agent mode is unavailable. Please configure EXPLAIN_GEMINI_API_KEY.",
                "tool_calls_used": [],
                "session_id": session_id,
                "turn_count": turn_count,
                "context_compressed": False,
                "document_references": [],
            }

        try:
            client = _genai.Client(api_key=settings.gemini_api_key)
            system_instruction = (
                AGENT_SYSTEM_PROMPT
                + f"\n\n## Session Context\n{context_header}"
                + rag_context_block
            )
            config = _t.GenerateContentConfig(
                tools=[self._gemini_tool],
                system_instruction=system_instruction,
                temperature=settings.default_temperature,
            )

            # Convert stored history to Gemini Content objects
            contents: list = []
            for msg in stored_history:
                role = msg.get("role", "user")
                text = msg.get("content", "")
                # Gemini only accepts "user" / "model" roles
                gemini_role = "user" if role == "user" else "model"
                contents.append(
                    _t.Content(role=gemini_role, parts=[_t.Part(text=text)])
                )

            # Append the new user message
            contents.append(
                _t.Content(role="user", parts=[_t.Part(text=new_message)])
            )

            tool_calls_used: list[str] = []

            # ── Agentic tool-calling loop ─────────────────────────────
            for _ in range(self._MAX_TOOL_ROUNDS):
                response = client.models.generate_content(
                    model=settings.llm_model,
                    contents=contents,
                    config=config,
                )

                function_calls = response.function_calls or []
                if not function_calls:
                    break

                contents.append(response.candidates[0].content)

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

                contents.append(
                    _t.Content(role="user", parts=tool_response_parts)
                )

            reply = (response.text or "").strip()
            if not reply:
                reply = "I was unable to generate a response. Please try again."

            # ── Persist the new turn to Redis ────────────────────────
            if svc and svc.is_ready:
                svc.append_messages(session_id, [
                    {"role": "user", "content": new_message},
                    {"role": "assistant", "content": reply},
                ])
                all_msgs = svc.get_messages(session_id)
                turn_count = len(all_msgs) // 2
            else:
                turn_count = len(stored_history) // 2 + 1

            return {
                "reply": reply,
                "tool_calls_used": tool_calls_used,
                "session_id": session_id,
                "turn_count": turn_count,
                "context_compressed": context_compressed,
                "document_references": [
                    {
                        "title": d.title,
                        "source": d.source,
                        "published_date": d.published_date,
                        "excerpt": d.excerpt[:300],
                        "relevance_score": d.relevance_score,
                    }
                    for d in rag_docs
                ],
            }

        except Exception as exc:
            print(f"[AgenticInsightService] Error: {exc}")
            return {
                "reply": f"An error occurred while processing your request: {exc}",
                "tool_calls_used": [],
                "session_id": session_id,
                "turn_count": len(stored_history) // 2,
                "context_compressed": context_compressed,
                "document_references": [],
            }
