"""
Enhancement 3: National situation report service.

Fetches all-district data from the NestJS backend, classifies each district,
and synthesises a 3-paragraph executive report for senior health officials.
"""

import json
from collections import defaultdict
from datetime import datetime, timezone

import httpx

from explain_analytics.config import settings
from explain_analytics.models import (
    DistrictHighlight,
    NationalSummaryResponse,
    TrendDirection,
)

_TIMEOUT = 15

_RISK_ORDER = {"critical": 0, "high": 1, "moderate": 2, "low": 3}

NATIONAL_SYSTEM_PROMPT = """\
You are a **Senior Epidemiologist** producing an executive situation report \
for the Director General of Health Services, Sri Lanka.

You have been given current dengue surveillance data for all districts in \
Sri Lanka. Your task is to write a situation report consisting of exactly \
3 plain-text paragraphs — no markdown, no bullet points, no headers.

**Paragraph 1 — National Overview**
Summarise the national dengue situation. State the total reported cases this \
week, how many districts fall in each risk tier (critical / high / moderate / \
low), and whether the national burden is rising, stable, or declining. If any \
district has crossed the critical threshold (≥ 100 cases/week), open with \
"URGENT:" and name those districts immediately.

**Paragraph 2 — High-Priority Districts**
For each critical and high-risk district, describe the specific situation using \
exact numbers: case count this week, week-over-week change percentage, and the \
dominant contributing factor (e.g. heavy rainfall, temperature, transmission \
acceleration). Mention any clusters of adjacent high-burden districts.

**Paragraph 3 — Recommended National Actions**
Provide 3–5 concrete, prioritised national-level recommendations. Cover \
resource allocation (rapid response teams, vector control, hospital capacity), \
any inter-district coordination needs, and public communication actions. \
Reference specific districts by name where appropriate.

**Output rules**
- Start Para 1 with "URGENT:" if any district is at critical risk.
- Use specific numbers throughout (percentages, case counts, district names).
- Do NOT use JSON, markdown, headers, or bullet points — plain prose only.
- Total length: 200–350 words.
"""


def _classify_risk(cases: int) -> str:
    if cases >= 100:
        return "critical"
    if cases >= 50:
        return "high"
    if cases >= 25:
        return "moderate"
    return "low"


def _derive_trend(trajectory: list[int]) -> TrendDirection:
    if len(trajectory) < 2:
        return "stable"
    recent_half = trajectory[: len(trajectory) // 2]
    older_half = trajectory[len(trajectory) // 2 :]
    avg_recent = sum(recent_half) / len(recent_half)
    avg_older = sum(older_half) / len(older_half)
    if avg_recent > avg_older * 1.10:
        return "rising"
    if avg_recent < avg_older * 0.90:
        return "falling"
    return "stable"


def _current_iso_week() -> str:
    today = datetime.now(timezone.utc)
    year, week, _ = today.isocalendar()
    return f"{year}-W{week:02d}"


class NationalSummaryService:
    """Fetches live all-district data and generates an executive situation report."""

    # ── Public entry point ───────────────────────────────────────────

    def generate(self, prediction_week: str | None = None) -> NationalSummaryResponse:
        raw_rows = self._fetch_all_districts()
        if not raw_rows:
            return self._unavailable_response(prediction_week)

        highlights = self._build_highlights(raw_rows)
        week = prediction_week or _current_iso_week()
        generated_at = datetime.now(timezone.utc).isoformat()

        by_risk: dict[str, int] = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
        for h in highlights:
            by_risk[h.risk_level] = by_risk.get(h.risk_level, 0) + 1

        urgent = [h.district for h in highlights if h.is_urgent]
        total_cases = sum(h.recent_case_count for h in highlights)

        report = self._generate_rule_based_report(
            highlights, week, by_risk, total_cases
        )
        phase = "national-rule-based"
        try:
            llm_report = self._generate_with_gemini(
                highlights, week, by_risk, total_cases
            )
            if llm_report:
                report = llm_report
                phase = "national-gemini"
        except Exception as exc:
            print(f"[NationalSummaryService] Gemini generation failed: {exc}")

        return NationalSummaryResponse(
            situation_report=report,
            urgent_districts=urgent,
            district_highlights=highlights,
            total_districts_analysed=len(highlights),
            total_national_cases=total_cases,
            by_risk_level=by_risk,
            prediction_week=week,
            generated_at=generated_at,
            implementation_phase=phase,
        )

    # ── Data fetching ────────────────────────────────────────────────

    def _fetch_all_districts(self) -> list[dict]:
        """Fetch all-district comparison data from the NestJS backend."""
        try:
            url = f"{settings.backend_api_url}/analytics/historical/districts/compare"
            resp = httpx.get(url, timeout=_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []
        except Exception as exc:
            print(f"[NationalSummaryService] Backend fetch failed: {exc}")
            return []

    # ── Data transformation ──────────────────────────────────────────

    def _build_highlights(self, rows: list[dict]) -> list[DistrictHighlight]:
        """Aggregate raw timeseries rows into one DistrictHighlight per district."""
        district_rows: dict[str, list[dict]] = defaultdict(list)
        for row in rows:
            name = row.get("district", "Unknown")
            district_rows[name].append(row)

        highlights: list[DistrictHighlight] = []
        for dist_name, d_rows in district_rows.items():
            d_rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))
            latest = d_rows[-1]
            latest_cases = latest.get("cases", 0) or 0

            wow: float | None = None
            if len(d_rows) >= 2:
                prev = d_rows[-2].get("cases", 0) or 0
                if prev > 0:
                    wow = round(((latest_cases - prev) / prev) * 100, 1)

            trajectory = [r.get("cases", 0) or 0 for r in d_rows[-4:]]
            trend = _derive_trend(trajectory)
            risk = _classify_risk(latest_cases)

            highlights.append(
                DistrictHighlight(
                    district=dist_name,
                    risk_level=risk,  # type: ignore[arg-type]
                    recent_case_count=latest_cases,
                    wow_pct=wow,
                    trend=trend,
                    is_urgent=(risk == "critical"),
                )
            )

        # Sort: critical first, then by case count descending
        highlights.sort(
            key=lambda h: (_RISK_ORDER.get(h.risk_level, 3), -h.recent_case_count)
        )
        return highlights

    # ── Report generation: rule-based fallback ───────────────────────

    def _generate_rule_based_report(
        self,
        highlights: list[DistrictHighlight],
        week: str,
        by_risk: dict[str, int],
        total_cases: int,
    ) -> str:
        critical = [h for h in highlights if h.risk_level == "critical"]
        high = [h for h in highlights if h.risk_level == "high"]
        prefix = "URGENT: " if critical else ""

        # Para 1 — National overview
        trend_counts = {"rising": 0, "falling": 0, "stable": 0}
        for h in highlights:
            trend_counts[h.trend] = trend_counts.get(h.trend, 0) + 1
        dominant_trend = max(trend_counts, key=lambda k: trend_counts[k])

        para1 = (
            f"{prefix}National dengue situation for {week}: "
            f"{total_cases:,} cases reported across {len(highlights)} districts. "
            f"Risk distribution — {by_risk['critical']} critical, {by_risk['high']} high, "
            f"{by_risk['moderate']} moderate, {by_risk['low']} low. "
            f"National case burden is {dominant_trend}."
        )

        # Para 2 — High-priority districts
        priority = (critical + high)[:6]
        if priority:
            lines: list[str] = []
            for h in priority:
                wow_str = (
                    f", {'+' if (h.wow_pct or 0) >= 0 else ''}{h.wow_pct:.1f}% WoW"
                    if h.wow_pct is not None
                    else ""
                )
                lines.append(
                    f"{h.district}: {h.recent_case_count} cases "
                    f"(risk: {h.risk_level}{wow_str}, trend: {h.trend})"
                )
            para2 = "High-priority districts this week: " + "; ".join(lines) + "."
        else:
            para2 = (
                "No districts have crossed the high or critical risk threshold this week. "
                "Moderate-risk districts should maintain routine surveillance."
            )

        # Para 3 — Recommendations
        if critical:
            actions = (
                "Activate emergency response protocols in critical-risk districts immediately. "
                "Deploy rapid response teams and initiate spatial fogging within 200 m of "
                "confirmed case clusters. Ensure hospital preparedness (IV fluids, platelet "
                "monitoring, ICU capacity) in affected areas. Coordinate inter-district vector "
                "control for adjacent high-burden regions. Issue a national public health advisory."
            )
        elif high:
            actions = (
                "Prioritise mobile vector control teams for fogging in high-risk districts. "
                "Intensify active case surveillance via fever clinics. Launch community "
                "source-reduction campaigns for stored water containers and construction sites. "
                "Monitor weekly trends and escalate if WoW increase exceeds 15%."
            )
        else:
            actions = (
                "Maintain routine vector surveillance and larviciding programs nationally. "
                "Reinforce community education on eliminating standing water. "
                "Monitor environmental risk indicators (rainfall, temperature) across all districts "
                "and reassess risk at the next weekly reporting cycle."
            )

        return f"{para1}\n\n{para2}\n\n{actions}"

    # ── Report generation: Gemini LLM ───────────────────────────────

    def _generate_with_gemini(
        self,
        highlights: list[DistrictHighlight],
        week: str,
        by_risk: dict[str, int],
        total_cases: int,
    ) -> str | None:
        if settings.llm_provider.lower() != "gemini":
            return None
        if not settings.gemini_api_key:
            return None

        from google import genai

        district_data = [
            {
                "district": h.district,
                "risk_level": h.risk_level,
                "cases_this_week": h.recent_case_count,
                "wow_change_pct": h.wow_pct,
                "trend": h.trend,
                "is_urgent": h.is_urgent,
            }
            for h in highlights
        ]

        data_block = json.dumps(
            {
                "prediction_week": week,
                "total_national_cases": total_cases,
                "by_risk_level": by_risk,
                "districts": district_data,
            },
            ensure_ascii=False,
            indent=2,
        )

        user_prompt = (
            f"Generate the national situation report for Sri Lanka dengue surveillance "
            f"based on the following data:\n\n{data_block}"
        )

        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=[
                {
                    "role": "user",
                    "parts": [{"text": NATIONAL_SYSTEM_PROMPT + "\n\n" + user_prompt}],
                }
            ],
            config={"temperature": settings.default_temperature},
        )

        text = (response.text or "").strip()
        return text if text else None

    # ── Fallback when backend is unreachable ─────────────────────────

    @staticmethod
    def _unavailable_response(prediction_week: str | None) -> NationalSummaryResponse:
        return NationalSummaryResponse(
            situation_report=(
                "National summary could not be generated: the analytics backend is currently "
                "unreachable. Ensure the EpiLink NestJS backend is running at "
                f"{settings.backend_api_url} and retry."
            ),
            urgent_districts=[],
            district_highlights=[],
            total_districts_analysed=0,
            total_national_cases=0,
            by_risk_level={"critical": 0, "high": 0, "moderate": 0, "low": 0},
            prediction_week=prediction_week,
            generated_at=datetime.now(timezone.utc).isoformat(),
            implementation_phase="national-unavailable",
        )
