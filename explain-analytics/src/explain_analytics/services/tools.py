"""Custom Agno tools that call back to the NestJS backend for live data.

Each tool returns pre-analyzed, structured output that the LLM can
directly reference in its response — no raw-data interpretation needed.
"""

import json
from collections import defaultdict

import httpx

from explain_analytics.config import settings

_TIMEOUT = 15
_PUBLIC_ANALYTICS_PREFIX = "/public/analytics"


def _to_public_analytics_path(path: str) -> str:
    """Map internal analytics paths to public analytics routes."""
    if path.startswith("/analytics/"):
        return f"{_PUBLIC_ANALYTICS_PREFIX}{path[len('/analytics') :]}"
    return path


def _api_get(path: str, params: dict | None = None) -> dict | list | None:
    """Helper: GET from the NestJS backend, return parsed JSON or None."""
    try:
        public_path = _to_public_analytics_path(path)
        url = f"{settings.backend_api_url}{public_path}"
        resp = httpx.get(url, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def compare_districts(districts: str) -> str:
    """Compare dengue statistics across multiple districts side-by-side.

    Use this tool when the user asks to compare two or more districts,
    e.g. "How does Colombo compare to Gampaha?" or "Compare the top 3 districts".
    Also use when asking which district is highest/lowest overall.

    Args:
        districts: Comma-separated district names, e.g. "Colombo,Gampaha,Kandy".
                   Pass an empty string "" to compare all districts.

    Returns:
        A structured comparison with latest cases, WoW change, 4-week average,
        and risk classification per district, plus a ranked analysis summary.
    """
    params = {"districts": districts} if districts.strip() else None
    data = _api_get("/analytics/historical/districts/compare", params)
    if not data:
        return json.dumps({"error": "Failed to fetch comparison data"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No data available for the requested districts"})

    # Aggregate per-district from full timeseries
    district_rows: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        name = row.get("district", "Unknown")
        district_rows[name].append(row)

    summaries = []
    for dist_name, d_rows in district_rows.items():
        # Ensure chronological order
        d_rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

        latest = d_rows[-1]
        latest_cases = latest.get("cases", 0) or 0

        # WoW change
        wow: float | None = None
        if len(d_rows) >= 2:
            prev = d_rows[-2].get("cases", 0) or 0
            if prev > 0:
                wow = round(((latest_cases - prev) / prev) * 100, 1)

        # 4-week average
        recent_4 = d_rows[-4:] if len(d_rows) >= 4 else d_rows
        avg_4w = round(
            sum(r.get("cases", 0) or 0 for r in recent_4) / max(len(recent_4), 1), 1
        )

        # Case trajectory (last 4 weeks)
        trajectory = [r.get("cases", 0) or 0 for r in recent_4]
        trajectory_str = " → ".join(str(v) for v in trajectory)

        # Simple risk classification
        risk = (
            "critical"
            if latest_cases >= 100
            else (
                "high"
                if latest_cases >= 50
                else "moderate" if latest_cases >= 25 else "low"
            )
        )

        summaries.append(
            {
                "district": dist_name,
                "current_cases": latest_cases,
                "prev_week_cases": (
                    (d_rows[-2].get("cases", 0) or 0) if len(d_rows) >= 2 else None
                ),
                "wow_change_pct": wow,
                "avg_4week_cases": avg_4w,
                "case_trajectory": trajectory_str,
                "temperature_c": latest.get("temperature"),
                "precipitation_mm": latest.get("precipitation"),
                "risk_level": risk,
            }
        )

    # Rank by current cases descending
    summaries.sort(key=lambda r: r.get("current_cases") or 0, reverse=True)

    analysis = ""
    if len(summaries) >= 2:
        top = summaries[0]
        bottom = summaries[-1]
        ratio = top["current_cases"] / max(bottom["current_cases"], 1)
        rising = [s for s in summaries if (s.get("wow_change_pct") or 0) > 10]
        declining = [s for s in summaries if (s.get("wow_change_pct") or 0) < -10]
        wow_sign = "+" if (top.get("wow_change_pct") or 0) >= 0 else ""
        analysis = (
            f"Highest burden: {top['district']} with {top['current_cases']} cases "
            f"({wow_sign}{top.get('wow_change_pct', 0) or 0}% WoW). "
            f"Lowest: {bottom['district']} ({bottom['current_cases']} cases). "
            f"Burden ratio: {ratio:.1f}×. "
            f"{len(rising)} district(s) rising >10% WoW, {len(declining)} declining."
        )
    elif summaries:
        s = summaries[0]
        analysis = f"{s['district']}: {s['current_cases']} cases this week (risk: {s['risk_level']})."

    return json.dumps(
        {
            "comparison": summaries,
            "analysis": analysis,
            "districts_analyzed": len(summaries),
        },
        indent=2,
        ensure_ascii=False,
    )


def year_over_year(district: str) -> str:
    """Get historical timeseries for a district to analyze trends and seasonal patterns.

    Use this when the user asks about historical comparison, trends over time,
    seasonal patterns, or "how does this compare to last year/month".

    Args:
        district: Name of the district to analyze, e.g. "Colombo"

    Returns:
        Recent 12-week timeseries with WoW changes, peak detection, and trend summary.
    """
    data = _api_get(f"/analytics/districts/{district}/timeseries")
    if not data:
        return json.dumps({"error": f"No timeseries data for {district}"})

    rows = data if isinstance(data, list) else []
    if not rows:
        return json.dumps({"info": f"No historical data available for {district}"})

    # Ensure chronological order
    rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

    # Take recent 12 weeks for richer trend context
    recent = rows[-12:] if len(rows) > 12 else rows
    enriched = []
    for i, row in enumerate(recent):
        cases = row.get("cases", 0) or 0
        prev_cases = recent[i - 1].get("cases", 0) if i > 0 else None
        wow_change: float | None = None
        if prev_cases is not None and prev_cases > 0:
            wow_change = round(((cases - prev_cases) / prev_cases) * 100, 1)
        enriched.append(
            {
                "year": row.get("year"),
                "week": row.get("week"),
                "cases": cases,
                "wow_change_pct": wow_change,
                "temperature_c": row.get("temperature"),
                "precipitation_mm": row.get("precipitation"),
            }
        )

    # Peak detection
    all_cases = [r["cases"] for r in enriched]
    peak_cases = max(all_cases) if all_cases else 0
    peak_entry = next((r for r in enriched if r["cases"] == peak_cases), None)

    # Overall trend
    direction = "stable"
    momentum_pct: float | None = None
    if len(enriched) >= 4:
        recent_avg = sum(r["cases"] for r in enriched[-2:]) / 2
        older_avg = sum(r["cases"] for r in enriched[:2]) / 2
        if older_avg > 0:
            momentum_pct = round(((recent_avg - older_avg) / older_avg) * 100, 1)
        if recent_avg > older_avg * 1.10:
            direction = "rising"
        elif recent_avg < older_avg * 0.90:
            direction = "falling"

    # First vs last for overall period change
    first_cases = enriched[0]["cases"] if enriched else 0
    last_cases = enriched[-1]["cases"] if enriched else 0
    period_change = (
        round(((last_cases - first_cases) / max(first_cases, 1)) * 100, 1)
        if first_cases > 0
        else 0.0
    )

    trend_analysis = (
        f"{district}: {first_cases} → {last_cases} cases over {len(enriched)} weeks "
        f"({'+' if period_change >= 0 else ''}{period_change}%, trend: {direction}). "
        f"Peak this period: {peak_cases} cases"
        + (f" in Week {peak_entry['week']}/{peak_entry['year']}" if peak_entry else "")
        + (
            f". Momentum: {'+' if (momentum_pct or 0) >= 0 else ''}{momentum_pct}% (recent 2w vs first 2w)"
            if momentum_pct is not None
            else ""
        )
        + "."
    )

    return json.dumps(
        {
            "district": district,
            "total_historical_weeks": len(rows),
            "recent_weeks": enriched,
            "peak_cases": peak_cases,
            "peak_entry": peak_entry,
            "trend_direction": direction,
            "period_change_pct": period_change,
            "trend_analysis": trend_analysis,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_weather_correlation() -> str:
    """Fetch Pearson correlation between weather variables and dengue across all districts.

    Use when the user asks about weather impact, climate factors,
    rainfall or temperature effects on dengue transmission.

    Returns:
        Per-district correlation coefficients (temp & precip), averages, and
        a ranked summary of strongest weather-dengue relationships.
    """
    data = _api_get("/analytics/advanced/weather-correlation")
    if not data:
        return json.dumps({"error": "Weather correlation data unavailable"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No weather correlation data available"})

    results = []
    for row in rows[:25]:
        temp_corr = row.get("temp_correlation", 0) or 0.0
        precip_corr = row.get("precip_correlation", 0) or 0.0

        temp_strength = (
            "strong"
            if abs(temp_corr) > 0.7
            else "moderate" if abs(temp_corr) > 0.4 else "weak"
        )
        precip_strength = (
            "strong"
            if abs(precip_corr) > 0.7
            else "moderate" if abs(precip_corr) > 0.4 else "weak"
        )

        results.append(
            {
                "district": row.get("district", "Unknown"),
                "temp_correlation": round(temp_corr, 3),
                "temp_strength": temp_strength,
                "precip_correlation": round(precip_corr, 3),
                "precip_strength": precip_strength,
                "avg_cases": round(row.get("avg_cases", 0) or 0, 1),
                "avg_temp_c": round(row.get("avg_temp", 0) or 0, 1),
                "avg_precip_mm": round(row.get("avg_precip", 0) or 0, 1),
                "data_points": row.get("data_points", 0),
            }
        )

    # Sort by strongest correlation (max of temp or precip abs value)
    results.sort(
        key=lambda r: max(abs(r["temp_correlation"]), abs(r["precip_correlation"])),
        reverse=True,
    )

    strong_temp = [r for r in results if abs(r["temp_correlation"]) > 0.7]
    strong_precip = [r for r in results if abs(r["precip_correlation"]) > 0.7]
    high_precip = [r for r in results if r["avg_precip_mm"] > 80]
    high_temp = [r for r in results if r["avg_temp_c"] > 29]

    insights = []
    if strong_temp:
        names = ", ".join(r["district"] for r in strong_temp[:3])
        insights.append(
            f"Strong temperature-dengue correlation (r>0.7) in {len(strong_temp)} district(s): {names}"
        )
    if strong_precip:
        names = ", ".join(r["district"] for r in strong_precip[:3])
        insights.append(
            f"Strong rainfall-dengue correlation (r>0.7) in {len(strong_precip)} district(s): {names}"
        )
    if high_precip:
        names = ", ".join(r["district"] for r in high_precip[:3])
        insights.append(
            f"High avg rainfall (>80mm/week) in: {names} — sustained vector breeding risk"
        )
    if high_temp:
        names = ", ".join(r["district"] for r in high_temp[:3])
        insights.append(
            f"High avg temperature (>29°C) in: {names} — accelerated Aedes aegypti lifecycle"
        )

    return json.dumps(
        {
            "correlations": results,
            "insights": insights
            or ["No significant weather-dengue correlations detected"],
            "summary": (
                f"Analyzed {len(results)} districts. "
                f"{len(strong_temp)} with strong temperature correlation, "
                f"{len(strong_precip)} with strong precipitation correlation."
            ),
        },
        indent=2,
        ensure_ascii=False,
    )


def get_outbreak_alerts() -> str:
    """Fetch current outbreak alert status for all districts.

    Use when the user asks about ongoing outbreaks, active alerts, or
    which districts are currently in an outbreak or warning state.

    Returns:
        Outbreak alert data sorted by severity with ratio-to-average metrics.
    """
    data = _api_get("/analytics/advanced/outbreak-alerts")
    if not data:
        return json.dumps({"error": "Outbreak alert service unavailable"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps(
            {"info": "No outbreak alerts — all districts within normal range."}
        )

    _severity_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}

    alerts = []
    for row in rows[:25]:
        current = row.get("current_cases", 0) or 0
        avg = row.get("avg_cases", 0) or 0.0
        ratio = round(current / avg, 1) if avg > 0 else None

        alerts.append(
            {
                "district": row.get("district", "Unknown"),
                "alert_level": row.get("alert_level", "Normal"),
                "severity": row.get("severity", "moderate"),
                "current_cases": current,
                "avg_4week_cases": round(avg, 1),
                "ratio_to_4week_avg": ratio,
                "description": row.get("description", ""),
            }
        )

    # Sort by severity then by cases
    alerts.sort(
        key=lambda a: (_severity_order.get(a["severity"], 3), -a["current_cases"])
    )

    outbreak_districts = [a for a in alerts if a["alert_level"] == "Outbreak Alert"]
    warning_districts = [a for a in alerts if a["alert_level"] == "Warning"]
    high_case_districts = [a for a in alerts if a["alert_level"] == "High Cases"]

    summary_parts: list[str] = []
    if outbreak_districts:
        names = ", ".join(a["district"] for a in outbreak_districts)
        summary_parts.append(
            f"OUTBREAK ALERT ({len(outbreak_districts)}): {names} — cases ≥2× 4-week avg"
        )
    if warning_districts:
        names = ", ".join(a["district"] for a in warning_districts)
        summary_parts.append(
            f"WARNING ({len(warning_districts)}): {names} — cases ≥1.5× average"
        )
    if high_case_districts:
        names = ", ".join(a["district"] for a in high_case_districts)
        summary_parts.append(f"High case load ({len(high_case_districts)}): {names}")
    if not summary_parts:
        summary_parts.append(f"{len(alerts)} district(s) flagged for monitoring")

    return json.dumps(
        {
            "alerts": alerts,
            "summary": " | ".join(summary_parts),
            "outbreak_count": len(outbreak_districts),
            "warning_count": len(warning_districts),
            "total_flagged": len(alerts),
        },
        indent=2,
        ensure_ascii=False,
    )


def get_growth_rate(weeks: int = 4) -> str:
    """Fetch case growth rate analysis to identify accelerating or declining districts.

    Use when the user asks about acceleration, growth rate, fastest-growing
    districts, or which areas are seeing the sharpest increase or decrease.

    Args:
        weeks: Number of recent weeks to compute growth over (default: 4)

    Returns:
        Growth rate per district sorted fastest-growing first, with
        counts of accelerating/stable/decelerating districts.
    """
    data = _api_get("/analytics/advanced/growth-rate", {"weeks": str(weeks)})
    if not data:
        return json.dumps({"error": "Growth rate data unavailable"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No growth rate data available"})

    rates = []
    for row in rows[:25]:
        growth = row.get("avg_growth_rate", 0) or 0.0
        current = row.get("current_cases", 0) or 0
        prev = row.get("prev_cases", 0) or 0
        rates.append(
            {
                "district": row.get("district", "Unknown"),
                "avg_growth_rate_pct": round(growth, 1),
                "trend": row.get("trend", "stable"),
                "current_cases": current,
                "prev_cases": prev,
                "absolute_change": current - prev,
            }
        )

    # Sort fastest-growing first
    rates.sort(key=lambda r: r.get("avg_growth_rate_pct") or 0, reverse=True)

    accelerating = [r for r in rates if (r.get("avg_growth_rate_pct") or 0) > 15]
    decelerating = [r for r in rates if (r.get("avg_growth_rate_pct") or 0) < -10]
    stable = [r for r in rates if -10 <= (r.get("avg_growth_rate_pct") or 0) <= 15]

    analysis_parts: list[str] = []
    if accelerating:
        top = accelerating[0]
        sign = "+" if (top.get("avg_growth_rate_pct") or 0) >= 0 else ""
        analysis_parts.append(
            f"Fastest growing: {top['district']} at {sign}{top['avg_growth_rate_pct']}% avg growth "
            f"({top['prev_cases']}→{top['current_cases']} cases)"
        )
        if len(accelerating) > 1:
            others = ", ".join(r["district"] for r in accelerating[1:4])
            analysis_parts.append(f"Also accelerating: {others}")
    if decelerating:
        best_declining = min(
            decelerating, key=lambda r: r.get("avg_growth_rate_pct") or 0
        )
        analysis_parts.append(
            f"Fastest declining: {best_declining['district']} at "
            f"{best_declining['avg_growth_rate_pct']}% "
            f"({best_declining['prev_cases']}→{best_declining['current_cases']} cases)"
        )
    analysis_parts.append(
        f"Summary over {weeks} weeks: "
        f"{len(accelerating)} accelerating, {len(stable)} stable, {len(decelerating)} declining."
    )

    return json.dumps(
        {
            "growth_rates": rates,
            "analysis": " ".join(analysis_parts),
            "accelerating_count": len(accelerating),
            "stable_count": len(stable),
            "decelerating_count": len(decelerating),
        },
        indent=2,
        ensure_ascii=False,
    )


def get_district_details(district: str) -> str:
    """Get comprehensive current statistics for a single district.

    Use this for deep single-district questions, or to get latest case counts,
    trend, weather context, and recent history for a specific area.

    Args:
        district: Name of the district to analyse, e.g. "Colombo"

    Returns:
        Latest cases, WoW change, 8-week trend, peak, weather context,
        and a plain-language summary for the district.
    """
    data = _api_get(f"/analytics/districts/{district}/timeseries")
    if not data:
        return json.dumps({"error": f"No data available for {district}"})

    rows = data if isinstance(data, list) else []
    if not rows:
        return json.dumps({"info": f"No data found for {district}"})

    # Chronological order
    rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

    latest = rows[-1]
    latest_cases = latest.get("cases", 0) or 0

    # Recent 8 weeks with WoW enrichment
    recent_8 = rows[-8:] if len(rows) >= 8 else rows
    enriched: list[dict] = []
    for i, row in enumerate(recent_8):
        cases = row.get("cases", 0) or 0
        prev = recent_8[i - 1].get("cases", 0) if i > 0 else None
        wow: float | None = None
        if prev is not None and prev > 0:
            wow = round(((cases - prev) / prev) * 100, 1)
        enriched.append(
            {
                "year": row.get("year"),
                "week": row.get("week"),
                "cases": cases,
                "wow_change_pct": wow,
                "temperature_c": row.get("temperature"),
                "precipitation_mm": row.get("precipitation"),
            }
        )

    # Stats
    case_vals = [r["cases"] for r in enriched]
    avg_8w = round(sum(case_vals) / len(case_vals), 1) if case_vals else 0
    peak = max(case_vals) if case_vals else 0
    peak_entry = next((r for r in enriched if r["cases"] == peak), None)

    # Trend
    trend = "stable"
    if len(enriched) >= 4:
        recent_avg = sum(r["cases"] for r in enriched[-2:]) / 2
        older_avg = sum(r["cases"] for r in enriched[:2]) / 2
        if recent_avg > older_avg * 1.10:
            trend = "rising"
        elif recent_avg < older_avg * 0.90:
            trend = "falling"

    latest_wow = enriched[-1].get("wow_change_pct") if enriched else None
    risk = (
        "critical"
        if latest_cases >= 100
        else (
            "high"
            if latest_cases >= 50
            else "moderate" if latest_cases >= 25 else "low"
        )
    )

    wow_str = (
        f"{'+' if (latest_wow or 0) >= 0 else ''}{latest_wow}% WoW"
        if latest_wow is not None
        else "WoW N/A"
    )
    summary = (
        f"{district}: {latest_cases} cases this week ({wow_str}), "
        f"8-week avg {avg_8w}, peak {peak} cases"
        + (f" in W{peak_entry['week']}/{peak_entry['year']}" if peak_entry else "")
        + f", trend: {trend}, risk: {risk}."
    )

    return json.dumps(
        {
            "district": district,
            "current_cases": latest_cases,
            "wow_change_pct": latest_wow,
            "avg_8week_cases": avg_8w,
            "peak_cases_8w": peak,
            "peak_entry": peak_entry,
            "trend": trend,
            "risk_level": risk,
            "latest_temperature_c": latest.get("temperature"),
            "latest_precipitation_mm": latest.get("precipitation"),
            "recent_history": enriched,
            "total_historical_weeks": len(rows),
            "summary": summary,
        },
        indent=2,
        ensure_ascii=False,
    )


# ── Sri Lanka district adjacency map ────────────────────────────────
# Each key lists districts that share a land border.
_ADJACENCY: dict[str, list[str]] = {
    "Colombo": ["Gampaha", "Kalutara"],
    "Gampaha": ["Colombo", "Kalutara", "Kandy", "Kegalle", "Kurunegala"],
    "Kalutara": ["Colombo", "Gampaha", "Ratnapura", "Galle"],
    "Kandy": ["Gampaha", "Kegalle", "Matale", "Nuwara Eliya", "Badulla", "Kurunegala"],
    "Matale": ["Kandy", "Kurunegala", "Anuradhapura", "Polonnaruwa", "Dambulla"],
    "Nuwara Eliya": ["Kandy", "Badulla", "Ratnapura", "Galle", "Matara"],
    "Galle": ["Kalutara", "Ratnapura", "Matara", "Nuwara Eliya"],
    "Matara": ["Galle", "Hambantota", "Nuwara Eliya"],
    "Hambantota": ["Matara", "Ratnapura", "Monaragala", "Badulla"],
    "Jaffna": ["Kilinochchi", "Mannar"],
    "Mannar": ["Jaffna", "Vavuniya", "Anuradhapura"],
    "Vavuniya": ["Mannar", "Kilinochchi", "Mullaitivu", "Anuradhapura", "Trincomalee"],
    "Mullaitivu": ["Kilinochchi", "Vavuniya", "Trincomalee", "Batticaloa"],
    "Kilinochchi": ["Jaffna", "Mannar", "Vavuniya", "Mullaitivu"],
    "Batticaloa": ["Mullaitivu", "Trincomalee", "Ampara", "Badulla"],
    "Ampara": ["Batticaloa", "Monaragala", "Badulla", "Polonnaruwa"],
    "Trincomalee": [
        "Vavuniya",
        "Mullaitivu",
        "Batticaloa",
        "Polonnaruwa",
        "Anuradhapura",
    ],
    "Kurunegala": ["Gampaha", "Kandy", "Matale", "Anuradhapura", "Puttalam", "Kegalle"],
    "Puttalam": ["Kurunegala", "Anuradhapura", "Mannar"],
    "Anuradhapura": [
        "Mannar",
        "Vavuniya",
        "Trincomalee",
        "Polonnaruwa",
        "Matale",
        "Kurunegala",
        "Puttalam",
    ],
    "Polonnaruwa": ["Trincomalee", "Batticaloa", "Ampara", "Anuradhapura", "Matale"],
    "Badulla": [
        "Kandy",
        "Nuwara Eliya",
        "Monaragala",
        "Ampara",
        "Batticaloa",
        "Hambantota",
    ],
    "Monaragala": ["Badulla", "Ampara", "Hambantota", "Ratnapura"],
    "Ratnapura": [
        "Kalutara",
        "Galle",
        "Nuwara Eliya",
        "Hambantota",
        "Monaragala",
        "Kegalle",
    ],
    "Kegalle": ["Gampaha", "Kandy", "Ratnapura", "Kurunegala"],
}

# ── MOH divisional secretariat / zone breakdown per district ────────
# Lists the main administrative zones with a typical urban/rural/coastal
# risk classification.  Used by get_demographic_hotspots().
_DISTRICT_ZONES: dict[str, list[dict]] = {
    "Colombo": [
        {"zone": "Colombo City", "type": "urban", "relative_risk": "high"},
        {"zone": "Dehiwala-Mt.Lavinia", "type": "urban", "relative_risk": "high"},
        {
            "zone": "Sri Jayawardenepura Kotte",
            "type": "urban",
            "relative_risk": "moderate",
        },
        {"zone": "Moratuwa", "type": "coastal-urban", "relative_risk": "moderate"},
        {"zone": "Kesbewa", "type": "peri-urban", "relative_risk": "moderate"},
    ],
    "Gampaha": [
        {"zone": "Negombo", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Wattala", "type": "urban", "relative_risk": "high"},
        {"zone": "Gampaha Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Katana", "type": "peri-urban", "relative_risk": "moderate"},
        {"zone": "Minuwangoda", "type": "rural", "relative_risk": "low"},
    ],
    "Kalutara": [
        {"zone": "Kalutara Town", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Panadura", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Horana", "type": "rural", "relative_risk": "moderate"},
        {"zone": "Agalawatta", "type": "rural", "relative_risk": "low"},
    ],
    "Kandy": [
        {"zone": "Kandy City", "type": "urban", "relative_risk": "high"},
        {"zone": "Peradeniya", "type": "peri-urban", "relative_risk": "moderate"},
        {"zone": "Katugastota", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Kundasale", "type": "rural", "relative_risk": "low"},
    ],
    "Ratnapura": [
        {"zone": "Ratnapura Town", "type": "urban", "relative_risk": "high"},
        {"zone": "Embilipitiya", "type": "rural", "relative_risk": "moderate"},
        {"zone": "Balangoda", "type": "rural", "relative_risk": "low"},
    ],
    "Galle": [
        {"zone": "Galle City", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Hikkaduwa", "type": "coastal-tourism", "relative_risk": "moderate"},
        {"zone": "Ambalangoda", "type": "coastal-urban", "relative_risk": "moderate"},
        {"zone": "Balapitiya", "type": "rural", "relative_risk": "low"},
    ],
    "Matara": [
        {"zone": "Matara City", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Weligama", "type": "coastal-urban", "relative_risk": "moderate"},
        {"zone": "Deniyaya", "type": "rural", "relative_risk": "low"},
    ],
    "Hambantota": [
        {"zone": "Hambantota Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Tangalle", "type": "coastal", "relative_risk": "moderate"},
        {"zone": "Tissamaharama", "type": "rural", "relative_risk": "low"},
    ],
    "Kurunegala": [
        {"zone": "Kurunegala Town", "type": "urban", "relative_risk": "high"},
        {"zone": "Kuliyapitiya", "type": "peri-urban", "relative_risk": "moderate"},
        {"zone": "Nikaweratiya", "type": "rural", "relative_risk": "low"},
    ],
    "Anuradhapura": [
        {"zone": "Anuradhapura City", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Medawachchiya", "type": "rural", "relative_risk": "low"},
        {"zone": "Kekirawa", "type": "rural", "relative_risk": "low"},
    ],
    "Polonnaruwa": [
        {"zone": "Polonnaruwa Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Kaduruwela", "type": "peri-urban", "relative_risk": "moderate"},
        {"zone": "Medirigiriya", "type": "rural-paddy", "relative_risk": "low"},
    ],
    "Batticaloa": [
        {"zone": "Batticaloa Town", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Kattankudy", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Eravur", "type": "coastal", "relative_risk": "moderate"},
    ],
    "Ampara": [
        {"zone": "Ampara Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Kalmunai", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Sammanthurai", "type": "rural", "relative_risk": "low"},
    ],
    "Trincomalee": [
        {"zone": "Trincomalee City", "type": "coastal-urban", "relative_risk": "high"},
        {"zone": "Kinniya", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Muttur", "type": "rural-coastal", "relative_risk": "low"},
    ],
    "Jaffna": [
        {"zone": "Jaffna City", "type": "urban", "relative_risk": "high"},
        {"zone": "Nallur", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Chavakachcheri", "type": "rural", "relative_risk": "low"},
    ],
    "Badulla": [
        {"zone": "Badulla Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Bandarawela", "type": "peri-urban", "relative_risk": "low"},
        {"zone": "Welimada", "type": "rural", "relative_risk": "low"},
    ],
    "Matale": [
        {"zone": "Matale Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Dambulla", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Galewela", "type": "rural", "relative_risk": "low"},
    ],
    "Kegalle": [
        {"zone": "Kegalle Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Mawanella", "type": "peri-urban", "relative_risk": "moderate"},
        {"zone": "Warakapola", "type": "rural", "relative_risk": "low"},
    ],
    "Nuwara Eliya": [
        {
            "zone": "Nuwara Eliya Town",
            "type": "urban-estate",
            "relative_risk": "moderate",
        },
        {"zone": "Hatton", "type": "estate", "relative_risk": "low"},
        {"zone": "Welimada", "type": "rural", "relative_risk": "low"},
    ],
    "Monaragala": [
        {"zone": "Monaragala Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Wellawaya", "type": "rural", "relative_risk": "low"},
        {"zone": "Bibile", "type": "rural", "relative_risk": "low"},
    ],
    "Puttalam": [
        {"zone": "Puttalam Town", "type": "coastal-urban", "relative_risk": "moderate"},
        {"zone": "Chilaw", "type": "coastal-urban", "relative_risk": "moderate"},
        {"zone": "Wennappuwa", "type": "coastal", "relative_risk": "low"},
    ],
    "Vavuniya": [
        {"zone": "Vavuniya Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Cheddikulam", "type": "rural", "relative_risk": "low"},
    ],
    "Mannar": [
        {"zone": "Mannar Town", "type": "coastal-urban", "relative_risk": "moderate"},
        {"zone": "Musali", "type": "rural", "relative_risk": "low"},
    ],
    "Mullaitivu": [
        {
            "zone": "Mullaitivu Town",
            "type": "coastal-urban",
            "relative_risk": "moderate",
        },
        {"zone": "Oddusuddan", "type": "rural", "relative_risk": "low"},
    ],
    "Kilinochchi": [
        {"zone": "Kilinochchi Town", "type": "urban", "relative_risk": "moderate"},
        {"zone": "Poonakary", "type": "rural", "relative_risk": "low"},
    ],
}
_DEFAULT_ZONES = [
    {"zone": "Main urban centre", "type": "urban", "relative_risk": "moderate"},
    {"zone": "Peri-urban zones", "type": "peri-urban", "relative_risk": "moderate"},
    {"zone": "Rural areas", "type": "rural", "relative_risk": "low"},
]

_RISK_WEIGHT = {"high": 3, "moderate": 2, "low": 1}


def get_seasonal_pattern(district: str, years: int = 3) -> str:
    """Analyse multi-year seasonal dengue patterns for a district to identify peak weeks.

    Use when the user asks about seasonal trends, peak season timing,
    "when is dengue worst in [district]", or how current activity compares to
    the historical seasonal baseline.

    Args:
        district: Name of the district, e.g. "Colombo"
        years:    Number of past years to include in the overlay (default: 3)

    Returns:
        Per-ISO-week averages across years, peak season windows, current week
        vs seasonal baseline, and a narrative seasonal interpretation.
    """
    data = _api_get(f"/analytics/districts/{district}/timeseries")
    if not data:
        return json.dumps({"error": f"No timeseries data for {district}"})

    rows = data if isinstance(data, list) else []
    if not rows:
        return json.dumps({"info": f"No data found for {district}"})

    rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

    # Limit to the requested number of years
    if rows:
        max_year = max(r.get("year", 0) for r in rows)
        cutoff_year = max_year - years
        rows = [r for r in rows if r.get("year", 0) > cutoff_year]

    # Group cases by ISO week number (1-52)
    week_buckets: dict[int, list[int]] = defaultdict(list)
    for row in rows:
        wk = row.get("week", 0)
        cases = row.get("cases", 0) or 0
        if wk:
            week_buckets[wk].append(cases)

    # Compute per-week stats
    weekly_avg: dict[int, float] = {
        wk: round(sum(vals) / len(vals), 1) for wk, vals in week_buckets.items()
    }

    # Identify peak season: contiguous block of weeks above 75th percentile
    all_avgs = sorted(weekly_avg.values())
    p75 = all_avgs[int(len(all_avgs) * 0.75)] if all_avgs else 0
    peak_weeks = sorted(wk for wk, avg in weekly_avg.items() if avg >= p75)

    # Detect blocks (consecutive weeks within ±2 of each other)
    peak_windows: list[tuple[int, int]] = []
    if peak_weeks:
        start = peak_weeks[0]
        end = peak_weeks[0]
        for w in peak_weeks[1:]:
            if w - end <= 2:
                end = w
            else:
                peak_windows.append((start, end))
                start = w
                end = w
        peak_windows.append((start, end))

    # Current week position
    current_entry = rows[-1] if rows else None
    current_week_num = current_entry.get("week", 0) if current_entry else 0
    current_cases = (current_entry.get("cases", 0) or 0) if current_entry else 0
    baseline = weekly_avg.get(current_week_num, 0)
    vs_baseline_pct = (
        round(((current_cases - baseline) / baseline) * 100, 1)
        if baseline > 0
        else None
    )

    # Absolute peak week
    peak_wk = max(weekly_avg, key=lambda k: weekly_avg[k]) if weekly_avg else None
    peak_avg = weekly_avg.get(peak_wk, 0) if peak_wk else 0

    # Seasonal narrative
    season_desc: list[str] = []
    for start_wk, end_wk in peak_windows:
        # Rough month mapping (week / 4.33 + 1 ≈ month)
        start_m = int((start_wk - 1) / 4.33) + 1
        end_m = int((end_wk - 1) / 4.33) + 1
        months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]
        sm = months[max(0, start_m - 1)]
        em = months[max(0, end_m - 1)]
        label = (
            f"Wk {start_wk}–{end_wk} ({sm}–{em})"
            if sm != em
            else f"Wk {start_wk}–{end_wk} ({sm})"
        )
        season_desc.append(label)

    in_peak = current_week_num in peak_weeks
    vs_str = ""
    if vs_baseline_pct is not None:
        sign = "+" if vs_baseline_pct >= 0 else ""
        vs_str = f" — {sign}{vs_baseline_pct}% vs seasonal baseline for this week"

    narrative = (
        f"{district} seasonal pattern ({years}yr overlay): "
        f"peak season window(s): {', '.join(season_desc) or 'not detected'}. "
        f"Historical peak at Week {peak_wk} (avg {peak_avg:.1f} cases). "
        f"Current week ({current_week_num}): {current_cases} cases{vs_str}. "
        f"Status: {'IN PEAK SEASON' if in_peak else 'outside peak season'}."
    )

    return json.dumps(
        {
            "district": district,
            "years_analysed": years,
            "weekly_averages": weekly_avg,
            "peak_weeks": peak_weeks,
            "peak_season_windows": [
                {"start_week": s, "end_week": e} for s, e in peak_windows
            ],
            "absolute_peak_week": peak_wk,
            "absolute_peak_avg_cases": peak_avg,
            "current_week": current_week_num,
            "current_cases": current_cases,
            "seasonal_baseline_this_week": baseline,
            "vs_baseline_pct": vs_baseline_pct,
            "in_peak_season": in_peak,
            "narrative": narrative,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_cross_district_spillover(district: str) -> str:
    """Assess geographic spillover risk by analysing the focal district and all its neighbours.

    Use when the user asks about spread to/from adjacent districts, cluster risk,
    "are nearby districts also rising", or inter-district transmission dynamics.

    Args:
        district: Name of the focal district, e.g. "Kandy"

    Returns:
        Focal district stats, neighbour stats, simultaneous-rise count, and a
        spillover risk assessment with narrative.
    """
    # Normalise input to title-case for adjacency lookup
    district_title = district.strip().title()
    neighbours = _ADJACENCY.get(district_title, [])

    all_districts = [district_title] + neighbours
    compare_param = ",".join(all_districts)
    data = _api_get(
        "/analytics/historical/districts/compare", {"districts": compare_param}
    )
    if not data:
        return json.dumps(
            {"error": "Failed to fetch district data for spillover analysis"}
        )

    rows = data if isinstance(data, list) else []
    if not rows:
        return json.dumps(
            {"info": f"No data available for {district} or its neighbours"}
        )

    # Aggregate per-district
    district_rows: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        name = row.get("district", "Unknown")
        district_rows[name].append(row)

    summaries = []
    for dist_name, d_rows in district_rows.items():
        d_rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))
        latest = d_rows[-1]
        latest_cases = latest.get("cases", 0) or 0
        wow: float | None = None
        if len(d_rows) >= 2:
            prev = d_rows[-2].get("cases", 0) or 0
            if prev > 0:
                wow = round(((latest_cases - prev) / prev) * 100, 1)
        risk = (
            "critical"
            if latest_cases >= 100
            else (
                "high"
                if latest_cases >= 50
                else "moderate" if latest_cases >= 25 else "low"
            )
        )
        summaries.append(
            {
                "district": dist_name,
                "is_focal": dist_name == district_title,
                "current_cases": latest_cases,
                "wow_change_pct": wow,
                "risk_level": risk,
                "is_rising": (wow or 0) > 10,
            }
        )

    focal = next((s for s in summaries if s["is_focal"]), None)
    neighbour_summaries = [s for s in summaries if not s["is_focal"]]

    # Count simultaneously-rising neighbours
    rising_neighbours = [s for s in neighbour_summaries if s["is_rising"]]
    high_risk_neighbours = [
        s for s in neighbour_summaries if s["risk_level"] in ("high", "critical")
    ]

    # Spillover risk level
    if len(rising_neighbours) >= 3 or len(high_risk_neighbours) >= 2:
        spillover_risk = "high"
    elif len(rising_neighbours) >= 1 or len(high_risk_neighbours) >= 1:
        spillover_risk = "moderate"
    else:
        spillover_risk = "low"

    focal_wow = focal.get("wow_change_pct") if focal else None
    focal_cases = focal.get("current_cases", 0) if focal else 0
    focal_risk = focal.get("risk_level", "unknown") if focal else "unknown"

    rising_names = ", ".join(s["district"] for s in rising_neighbours[:5])
    high_names = ", ".join(s["district"] for s in high_risk_neighbours[:5])

    narrative = (
        f"Spillover risk for {district_title}: {spillover_risk.upper()}. "
        f"Focal district — {focal_cases} cases, risk: {focal_risk}"
        + (
            f", {'+' if (focal_wow or 0) >= 0 else ''}{focal_wow}% WoW"
            if focal_wow is not None
            else ""
        )
        + f". Neighbours monitored: {len(neighbour_summaries)}. "
        f"Rising neighbours (>10% WoW): {len(rising_neighbours)}"
        + (f" — {rising_names}" if rising_names else "")
        + f". High/critical-risk neighbours: {len(high_risk_neighbours)}"
        + (f" — {high_names}" if high_names else "")
        + "."
    )

    if spillover_risk == "high":
        narrative += (
            " CAUTION: Multiple adjacent districts are simultaneously rising — "
            "inter-district vector movement or shared breeding sites likely. "
            "Coordinate cross-district vector control."
        )
    elif spillover_risk == "moderate":
        narrative += " Monitor borders closely; consider joint surveillance with adjacent health teams."

    return json.dumps(
        {
            "focal_district": district_title,
            "focal_stats": focal,
            "neighbours": neighbour_summaries,
            "rising_neighbours": rising_neighbours,
            "high_risk_neighbours": high_risk_neighbours,
            "spillover_risk": spillover_risk,
            "narrative": narrative,
            "adjacency_known": len(neighbours) > 0,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_intervention_history(district: str) -> str:
    """Analyse the timeseries to identify past response periods and intervention signals.

    Use when the user asks about past interventions, "what happened after the last
    peak", when outbreaks were brought under control, or the effectiveness of past
    control measures.

    A response event is inferred when cases fall ≥30% WoW for two consecutive
    weeks following a peak — consistent with a successful vector-control campaign.

    Args:
        district: Name of the district, e.g. "Colombo"

    Returns:
        List of inferred response events with peak/trough details and a narrative
        of intervention patterns for the district.
    """
    data = _api_get(f"/analytics/districts/{district}/timeseries")
    if not data:
        return json.dumps({"error": f"No timeseries data for {district}"})

    rows = data if isinstance(data, list) else []
    if not rows:
        return json.dumps({"info": f"No historical data for {district}"})

    rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))
    cases_series = [r.get("cases", 0) or 0 for r in rows]

    # Detect local peaks: case count higher than both neighbours
    peaks: list[int] = []
    for i in range(1, len(cases_series) - 1):
        if (
            cases_series[i] > cases_series[i - 1]
            and cases_series[i] > cases_series[i + 1]
        ):
            if cases_series[i] >= 25:  # only count meaningful peaks
                peaks.append(i)

    # For each peak, detect a post-peak decline event (≥30% drop in ≤4 weeks)
    response_events: list[dict] = []
    for peak_idx in peaks:
        peak_cases = cases_series[peak_idx]
        peak_row = rows[peak_idx]
        # Look up to 6 weeks ahead for the recovery trough
        recovery_weeks = cases_series[peak_idx + 1 : peak_idx + 7]
        if not recovery_weeks:
            continue
        trough = min(recovery_weeks)
        trough_idx = peak_idx + 1 + recovery_weeks.index(trough)
        trough_row = rows[trough_idx]
        decline_pct = (
            round(((trough - peak_cases) / peak_cases) * 100, 1)
            if peak_cases > 0
            else 0
        )
        weeks_to_recover = trough_idx - peak_idx

        if decline_pct <= -30:  # 30%+ decline = likely intervention response
            response_events.append(
                {
                    "peak_year": peak_row.get("year"),
                    "peak_week": peak_row.get("week"),
                    "peak_cases": peak_cases,
                    "trough_year": trough_row.get("year"),
                    "trough_week": trough_row.get("week"),
                    "trough_cases": trough,
                    "decline_pct": decline_pct,
                    "weeks_to_recovery": weeks_to_recover,
                    "response_effectiveness": (
                        "rapid"
                        if weeks_to_recover <= 2
                        else "moderate" if weeks_to_recover <= 4 else "slow"
                    ),
                    "inferred_action": (
                        "Emergency fogging campaign + source-reduction drive (consistent with rapid >30% decline)"
                        if decline_pct <= -50
                        else "Vector control intervention (30–50% decline)"
                    ),
                }
            )

    # Most recent peak for context
    most_recent_peak = response_events[-1] if response_events else None

    # Average time to recovery
    avg_recovery = (
        round(
            sum(e["weeks_to_recovery"] for e in response_events) / len(response_events),
            1,
        )
        if response_events
        else None
    )

    narrative_parts: list[str] = [
        f"{district} intervention history: {len(response_events)} response events detected "
        f"over {len(rows)} weeks of data."
    ]
    if most_recent_peak:
        narrative_parts.append(
            f"Most recent: W{most_recent_peak['peak_week']}/{most_recent_peak['peak_year']} "
            f"peak ({most_recent_peak['peak_cases']} cases) followed by "
            f"{most_recent_peak['decline_pct']}% decline — "
            f"{most_recent_peak['response_effectiveness']} recovery."
        )
    if avg_recovery is not None:
        narrative_parts.append(
            f"Average response effectiveness: {avg_recovery} weeks to post-peak trough."
        )
    if not response_events:
        narrative_parts.append(
            "No clear rapid-response decline events detected. District may not have experienced "
            "large peaks in the data window, or response data is unavailable."
        )

    return json.dumps(
        {
            "district": district,
            "response_events": response_events,
            "total_events_detected": len(response_events),
            "average_weeks_to_recovery": avg_recovery,
            "most_recent_event": most_recent_peak,
            "narrative": " ".join(narrative_parts),
            "data_note": (
                "Response events are inferred from significant post-peak case declines (≥30% in ≤6 weeks). "
                "These are epidemiological indicators of control activity, not confirmed programme records."
            ),
        },
        indent=2,
        ensure_ascii=False,
    )


def get_model_performance_metrics(district: str) -> str:
    """Evaluate recent prediction accuracy for a district by comparing forecasts to actuals.

    Use when the user asks about model accuracy, prediction reliability,
    "how accurate is the forecast for [district]", or whether to trust the ML predictions.

    Compares the most recent ML-predicted case count against the actual reported
    cases and analyses the accuracy of the directional trend forecast.

    Args:
        district: Name of the district, e.g. "Colombo"

    Returns:
        Latest prediction vs actual, absolute/percentage error, directional accuracy,
        recent trend agreement, and a reliability assessment.
    """
    # Fetch latest ML predictions for all districts
    latest_predictions = _api_get("/analytics/districts/latest")
    # Fetch timeseries (actuals)
    timeseries = _api_get(f"/analytics/districts/{district}/timeseries")

    if not latest_predictions or not timeseries:
        return json.dumps(
            {"error": f"Insufficient data to evaluate model performance for {district}"}
        )

    # Find this district's latest prediction
    pred_rows = latest_predictions if isinstance(latest_predictions, list) else []
    pred_entry = next(
        (r for r in pred_rows if r.get("district", "").lower() == district.lower()),
        None,
    )

    ts_rows = timeseries if isinstance(timeseries, list) else []
    ts_rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

    if not ts_rows:
        return json.dumps({"error": f"No timeseries data for {district}"})

    latest_actual = ts_rows[-1]
    actual_cases = latest_actual.get("cases", 0) or 0
    actual_year = latest_actual.get("year")
    actual_week = latest_actual.get("week")

    # Compare prediction vs latest actual (same week if available)
    predicted_cases: int | None = None
    prediction_week: str | None = None
    abs_error: float | None = None
    pct_error: float | None = None
    accuracy_class = "unavailable"

    if pred_entry:
        predicted_cases = pred_entry.get("predicted_cases")
        pred_year = pred_entry.get("year")
        pred_week = pred_entry.get("week")
        prediction_week = (
            f"{pred_year}-W{pred_week:02d}" if pred_year and pred_week else None
        )

        if predicted_cases is not None and actual_cases > 0:
            abs_error = round(abs(predicted_cases - actual_cases), 1)
            pct_error = round(
                abs(predicted_cases - actual_cases) / actual_cases * 100, 1
            )
            accuracy_class = (
                "excellent"
                if pct_error <= 10
                else (
                    "good"
                    if pct_error <= 20
                    else "moderate" if pct_error <= 35 else "poor"
                )
            )

    # Directional accuracy: does the model trend match the actual recent trend?
    recent_8 = ts_rows[-8:] if len(ts_rows) >= 8 else ts_rows
    actual_trend = "stable"
    if len(recent_8) >= 4:
        recent_avg = sum(r.get("cases", 0) or 0 for r in recent_8[-2:]) / 2
        older_avg = sum(r.get("cases", 0) or 0 for r in recent_8[:2]) / 2
        if recent_avg > older_avg * 1.10:
            actual_trend = "rising"
        elif recent_avg < older_avg * 0.90:
            actual_trend = "falling"

    # Compute 8-week MAE from WoW-implied predictions
    # (use last week's actual as a naive baseline to benchmark the model against)
    naive_errors: list[float] = []
    for i in range(1, len(recent_8)):
        naive_pred = recent_8[i - 1].get("cases", 0) or 0
        actual = recent_8[i].get("cases", 0) or 0
        naive_errors.append(abs(naive_pred - actual))
    naive_mae = (
        round(sum(naive_errors) / len(naive_errors), 1) if naive_errors else None
    )

    # Build summary narrative
    parts: list[str] = [f"Model performance for {district}:"]
    if predicted_cases is not None and actual_cases is not None:
        parts.append(
            f"Latest prediction: {predicted_cases} cases vs actual: {actual_cases} cases "
            f"(error: {abs_error}, {pct_error}% — {accuracy_class} accuracy)."
        )
    else:
        parts.append("Prediction not available for comparison this week.")

    parts.append(f"Observed trend: {actual_trend}.")
    if naive_mae is not None:
        parts.append(
            f"Naive persistence MAE (baseline): {naive_mae} — "
            f"model should outperform this to add value."
        )
    parts.append(
        "Note: comprehensive back-testing requires stored historical predictions; "
        "this evaluation uses the most recent available forecast-actual pair."
    )

    return json.dumps(
        {
            "district": district,
            "actual_week": (
                f"{actual_year}-W{actual_week:02d}"
                if actual_year and actual_week
                else None
            ),
            "actual_cases": actual_cases,
            "predicted_cases": predicted_cases,
            "prediction_week": prediction_week,
            "absolute_error": abs_error,
            "percentage_error_pct": pct_error,
            "accuracy_class": accuracy_class,
            "observed_trend": actual_trend,
            "naive_persistence_mae_8w": naive_mae,
            "narrative": " ".join(parts),
        },
        indent=2,
        ensure_ascii=False,
    )


def get_demographic_hotspots(district: str) -> str:
    """Identify likely sub-district demographic and geographic hotspots for targeted intervention.

    Use when the user asks about which parts of a district need action, where
    to deploy resources, high-density or high-risk zones, or sub-district breakdown.

    Combines the district's current case load with a hardcoded MOH divisional
    zone classification (urban/peri-urban/coastal/rural) to estimate zone-level
    risk and recommend targeted intervention sites.

    Args:
        district: Name of the district, e.g. "Colombo"

    Returns:
        Zone-level risk breakdown, recommended intervention priority sites,
        and contextual guidance for resource deployment.
    """
    data = _api_get(f"/analytics/districts/{district}/timeseries")
    if not data:
        return json.dumps({"error": f"No timeseries data for {district}"})

    ts_rows = data if isinstance(data, list) else []
    ts_rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

    district_title = district.strip().title()
    zones = _DISTRICT_ZONES.get(district_title, _DEFAULT_ZONES)

    latest = ts_rows[-1] if ts_rows else {}
    total_cases = latest.get("cases", 0) or 0
    temperature = latest.get("temperature")
    precipitation = latest.get("precipitation")

    # Estimate case distribution across zones using relative risk weights
    total_weight = sum(_RISK_WEIGHT.get(z["relative_risk"], 1) for z in zones)
    zone_estimates: list[dict] = []
    for zone in zones:
        weight = _RISK_WEIGHT.get(zone["relative_risk"], 1)
        estimated_cases = (
            round(total_cases * weight / total_weight) if total_weight > 0 else 0
        )
        # Boost coastal and urban zones in high precipitation periods
        context_flags: list[str] = []
        if (
            precipitation
            and precipitation > 60
            and zone["type"] in ("coastal", "coastal-urban", "coastal-tourism")
        ):
            context_flags.append(
                "elevated: high rainfall increases coastal waterlogging"
            )
        if (
            temperature
            and temperature > 29
            and zone["type"] in ("urban", "coastal-urban")
        ):
            context_flags.append(
                "elevated: high temp accelerates urban Aedes lifecycle"
            )
        if zone["type"] == "urban" and total_cases >= 50:
            context_flags.append(
                "priority: dense housing increases human-vector contact"
            )
        if zone["type"] in ("rural-paddy",):
            context_flags.append(
                "note: irrigation infrastructure creates persistent breeding sites"
            )
        zone_estimates.append(
            {
                "zone": zone["zone"],
                "type": zone["type"],
                "relative_risk": zone["relative_risk"],
                "estimated_cases": estimated_cases,
                "context_flags": context_flags,
                "intervention_priority": (
                    "immediate"
                    if zone["relative_risk"] == "high" and total_cases >= 50
                    else (
                        "high"
                        if zone["relative_risk"] == "high"
                        else (
                            "moderate"
                            if zone["relative_risk"] == "moderate"
                            else "routine"
                        )
                    )
                ),
            }
        )

    # Sort by intervention priority
    priority_order = {"immediate": 0, "high": 1, "moderate": 2, "routine": 3}
    zone_estimates.sort(key=lambda z: priority_order.get(z["intervention_priority"], 3))

    # Top priority sites
    top_sites = [
        z["zone"]
        for z in zone_estimates
        if z["intervention_priority"] in ("immediate", "high")
    ]

    district_risk = (
        "critical"
        if total_cases >= 100
        else "high" if total_cases >= 50 else "moderate" if total_cases >= 25 else "low"
    )

    narrative_parts: list[str] = [
        f"Demographic hotspot analysis for {district_title} ({total_cases} cases, district risk: {district_risk})."
    ]
    if top_sites:
        narrative_parts.append(
            f"Priority intervention zones: {', '.join(top_sites[:4])}."
        )
    if precipitation and precipitation > 60:
        narrative_parts.append(
            f"High precipitation ({precipitation:.0f}mm) this week — coastal and low-lying zones have elevated standing-water risk."
        )
    if temperature and temperature > 29:
        narrative_parts.append(
            f"Temperature {temperature:.1f}°C — urban zones face accelerated Aedes aegypti breeding cycles."
        )
    narrative_parts.append(
        "Zone estimates are proportional risk allocations based on settlement type; "
        "GND-level surveillance data should confirm exact hotspot locations."
    )

    return json.dumps(
        {
            "district": district_title,
            "total_district_cases": total_cases,
            "district_risk_level": district_risk,
            "zone_breakdown": zone_estimates,
            "top_priority_zones": top_sites,
            "temperature_c": temperature,
            "precipitation_mm": precipitation,
            "narrative": " ".join(narrative_parts),
            "data_note": (
                "Case distribution across zones is estimated from relative risk weights "
                "(urban > peri-urban > rural). Actual sub-district counts require GND-level MOH reporting."
            ),
        },
        indent=2,
        ensure_ascii=False,
    )


def get_national_briefing() -> str:
    """Get a national-level dengue situation summary across all districts.

    Use this when the user asks about the overall/national situation, total case burden,
    how many districts are at high risk, or wants a country-wide briefing.
    No arguments needed.
    """
    data = _api_get("/analytics/summary")
    if not data:
        return json.dumps({"error": "Failed to fetch national summary"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No national summary data available"})

    # If the endpoint returns per-district rows, aggregate them
    if isinstance(data, list) and len(rows) > 1:
        total_cases = sum(r.get("cases", 0) or 0 for r in rows)
        all_wows: list[float] = []
        rising, falling, stable_count = [], [], []
        critical_districts, high_districts = [], []

        for r in rows:
            name = r.get("district", "Unknown")
            cases = r.get("cases", 0) or 0
            wow = r.get("wow_change_pct") or r.get("wowChangePct")
            if wow is not None:
                wow = float(wow)
                all_wows.append(wow)
                if wow > 10:
                    rising.append(name)
                elif wow < -10:
                    falling.append(name)
                else:
                    stable_count.append(name)

            if cases >= 100:
                critical_districts.append({"district": name, "cases": cases})
            elif cases >= 50:
                high_districts.append({"district": name, "cases": cases})

        critical_districts.sort(key=lambda d: d["cases"], reverse=True)
        high_districts.sort(key=lambda d: d["cases"], reverse=True)
        top_hotspots = (critical_districts + high_districts)[:5]

        national_wow = round(sum(all_wows) / len(all_wows), 1) if all_wows else None
        if national_wow is not None:
            trend_direction = (
                "rising" if national_wow > 5 else "falling" if national_wow < -5 else "stable"
            )
        else:
            trend_direction = "unknown"

        summary_line = (
            f"National total: {total_cases} cases across {len(rows)} districts. "
            f"{len(critical_districts)} critical, {len(high_districts)} high-burden. "
            f"{len(rising)} rising, {len(stable_count)} stable, {len(falling)} falling. "
            f"National avg WoW: {('+' if (national_wow or 0) >= 0 else '')}{national_wow}%."
            if national_wow is not None
            else f"National total: {total_cases} cases across {len(rows)} districts. "
            f"{len(critical_districts)} critical, {len(high_districts)} high-burden."
        )

        return json.dumps(
            {
                "total_cases": total_cases,
                "districts_analyzed": len(rows),
                "critical_count": len(critical_districts),
                "high_risk_count": len(high_districts),
                "top_hotspots": top_hotspots,
                "national_wow_pct": national_wow,
                "trend_direction": trend_direction,
                "districts_rising": rising,
                "districts_falling": falling,
                "districts_stable": stable_count,
                "summary": summary_line,
            },
            indent=2,
            ensure_ascii=False,
        )

    # Single-object summary response from a dedicated endpoint
    summary = rows[0]
    total_cases = summary.get("total_cases") or summary.get("totalCases", 0)
    critical_count = summary.get("critical_count") or summary.get("criticalCount", 0)
    high_risk_count = summary.get("high_risk_count") or summary.get("highRiskCount", 0)
    national_wow = summary.get("national_wow_pct") or summary.get("nationalWowPct")
    trend_direction = summary.get("trend_direction") or summary.get("trendDirection", "unknown")
    top_hotspots = summary.get("top_hotspots") or summary.get("topHotspots") or []

    summary_line = (
        f"National total: {total_cases} cases. "
        f"{critical_count} critical districts, {high_risk_count} high-risk. "
        f"Trend: {trend_direction}."
    )

    return json.dumps(
        {
            "total_cases": total_cases,
            "critical_count": critical_count,
            "high_risk_count": high_risk_count,
            "top_hotspots": top_hotspots,
            "national_wow_pct": national_wow,
            "trend_direction": trend_direction,
            "summary": summary_line,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_weekly_ml_forecast(district: str = "") -> str:
    """Get the ML model's 1-week-ahead dengue case forecast.

    Use when the user asks about predicted/forecast cases, what the model expects
    next week, or wants to compare current cases to the model prediction.

    Args:
        district: Optional district name to filter. Empty string returns all districts.
    """
    params = {"district": district} if district.strip() else None
    data = _api_get("/analytics/advanced/weekly-forecast", params)
    if not data:
        return json.dumps({"error": "Failed to fetch weekly forecast"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No forecast data available"})

    forecasts = []
    for row in rows:
        predicted = row.get("predicted_cases") or row.get("predictedCases")
        current = row.get("current_cases") or row.get("currentCases") or row.get("cases", 0) or 0
        confidence = row.get("prediction_confidence") or row.get("predictionConfidence")
        forecast_week = row.get("forecast_week") or row.get("forecastWeek")
        forecast_year = row.get("forecast_year") or row.get("forecastYear")

        # Derive comparison to current
        comparison: str | None = None
        change_pct: float | None = None
        if predicted is not None and current > 0:
            change_pct = round(((predicted - current) / current) * 100, 1)
            if change_pct > 10:
                comparison = f"forecast {change_pct:+.1f}% above current — rising expected"
            elif change_pct < -10:
                comparison = f"forecast {change_pct:+.1f}% below current — decline expected"
            else:
                comparison = f"forecast near current ({change_pct:+.1f}%) — stable expected"

        # Trend direction from forecast vs current
        trend = (
            "rising"
            if (change_pct or 0) > 10
            else "falling" if (change_pct or 0) < -10 else "stable"
        )

        entry: dict = {
            "district": row.get("district", "National") if not district.strip() else district,
            "predicted_cases": predicted,
            "current_cases": current,
            "forecast_change_pct": change_pct,
            "comparison_to_current": comparison,
            "trend_direction": trend,
            "prediction_confidence": confidence,
        }
        if forecast_week and forecast_year:
            entry["forecast_week"] = f"{forecast_year}-W{int(forecast_week):02d}"
        elif forecast_week:
            entry["forecast_week"] = str(forecast_week)

        forecasts.append(entry)

    # Sort by predicted cases descending when multi-district
    if len(forecasts) > 1:
        forecasts.sort(key=lambda r: r.get("predicted_cases") or 0, reverse=True)

    rising = [f for f in forecasts if f["trend_direction"] == "rising"]
    falling = [f for f in forecasts if f["trend_direction"] == "falling"]
    stable = [f for f in forecasts if f["trend_direction"] == "stable"]

    if len(forecasts) == 1:
        f = forecasts[0]
        summary = (
            f"{f['district']}: model forecasts {f['predicted_cases']} cases next week "
            f"(current: {f['current_cases']}). {f.get('comparison_to_current', '')}."
        )
    else:
        top = forecasts[0]
        summary = (
            f"Forecast across {len(forecasts)} districts — "
            f"highest predicted: {top['district']} ({top['predicted_cases']} cases). "
            f"{len(rising)} rising, {len(stable)} stable, {len(falling)} declining."
        )

    return json.dumps(
        {
            "forecasts": forecasts,
            "districts_rising": len(rising),
            "districts_stable": len(stable),
            "districts_falling": len(falling),
            "summary": summary,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_rapid_hotspots(top_n: int = 5) -> str:
    """Identify the top N dengue hotspot districts by current case magnitude and trajectory.

    Use when the user asks "where should resources be deployed?", "which districts are
    worst right now?", or needs a quick priority-ranked triage of all districts.
    Different from outbreak_alerts — ranks by absolute burden, not ratio thresholds.

    Args:
        top_n: Number of top hotspot districts to return (default 5, max 10).
    """
    top_n = max(1, min(int(top_n), 10))
    data = _api_get("/analytics/advanced/hotspots")
    if not data:
        return json.dumps({"error": "Failed to fetch hotspot data"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No hotspot data available"})

    scored = []
    for row in rows:
        cases = row.get("current_cases") or row.get("currentCases") or row.get("cases", 0) or 0
        wow = row.get("wow_change_pct") or row.get("wowChangePct") or row.get("avg_growth_rate", 0) or 0
        avg_4w = row.get("avg_cases") or row.get("avgCases") or row.get("avg_4week_cases") or 1

        # Hotspot score: weighted combination of absolute burden + trajectory
        # Normalise WoW to 0-1 range (cap at 100%) then blend 70% cases + 30% trajectory
        wow_norm = min(abs(float(wow)) / 100.0, 1.0) if wow else 0.0
        cases_norm = float(cases) / max(float(avg_4w) * 4, 1)
        hotspot_score = round(0.70 * cases_norm + 0.30 * wow_norm, 3)

        risk = (
            "critical" if cases >= 100
            else "high" if cases >= 50
            else "moderate" if cases >= 25
            else "low"
        )

        wow_f = float(wow)
        priority_action = (
            "Deploy rapid response team immediately"
            if cases >= 100 or wow_f >= 50
            else "Intensify vector control and surveillance"
            if cases >= 50 or wow_f >= 25
            else "Increase monitoring frequency"
        )

        scored.append(
            {
                "district": row.get("district", "Unknown"),
                "current_cases": cases,
                "wow_change_pct": round(wow_f, 1),
                "avg_4week_cases": round(float(avg_4w), 1),
                "hotspot_score": hotspot_score,
                "risk_level": risk,
                "priority_action": priority_action,
            }
        )

    # Rank by hotspot score descending
    scored.sort(key=lambda r: r["hotspot_score"], reverse=True)
    top = scored[:top_n]

    top_names = ", ".join(r["district"] for r in top[:3])
    critical = [r for r in top if r["risk_level"] == "critical"]
    summary = (
        f"Top {len(top)} hotspots (by case burden + trajectory): {top_names}. "
        f"{len(critical)} critical district(s) requiring immediate action."
    )

    return json.dumps(
        {
            "hotspots": top,
            "total_districts_analyzed": len(scored),
            "critical_count": len(critical),
            "summary": summary,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_historical_range(
    district: str,
    start_year: int,
    start_week: int,
    end_year: int,
    end_week: int,
) -> str:
    """Fetch dengue case data for a specific date range for a district.

    Use when the user specifies a time window: "show me June to September 2024",
    "what happened in week 20–35", "compare a specific outbreak period", or any
    question requiring data outside the standard recent-weeks window.

    Args:
        district: District name.
        start_year: ISO year of the range start (e.g. 2024).
        start_week: ISO week number of range start (1–52).
        end_year: ISO year of the range end.
        end_week: ISO week number of range end (1–52).
    """
    params = {
        "startYear": start_year,
        "startWeek": start_week,
        "endYear": end_year,
        "endWeek": end_week,
    }
    data = _api_get("/analytics/historical/range", params)
    if not data:
        return json.dumps({"error": f"No data found for {district} in the specified range"})

    rows = data if isinstance(data, list) else [data]

    # Filter to the requested district (service returns all districts)
    district_rows = [
        r for r in rows if r.get("district", "").lower() == district.strip().lower()
    ]
    if not district_rows:
        return json.dumps({
            "error": f"No data for '{district}' in {start_year}-W{start_week:02d} to {end_year}-W{end_week:02d}. "
                     f"Check the district name or date range."
        })

    # Ensure chronological order
    district_rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))

    # Enrich with WoW changes
    enriched = []
    for i, row in enumerate(district_rows):
        cases = row.get("cases", 0) or 0
        prev_cases = district_rows[i - 1].get("cases", 0) if i > 0 else None
        wow: float | None = None
        if prev_cases is not None and prev_cases > 0:
            wow = round(((cases - prev_cases) / prev_cases) * 100, 1)
        enriched.append({
            "year": row.get("year"),
            "week": row.get("week"),
            "cases": cases,
            "wow_change_pct": wow,
            "temperature_c": row.get("temperature"),
            "precipitation_mm": row.get("precipitation"),
        })

    # Aggregate stats
    all_cases = [r["cases"] for r in enriched]
    total_cases = sum(all_cases)
    peak_cases = max(all_cases) if all_cases else 0
    peak_entry = next((r for r in enriched if r["cases"] == peak_cases), None)

    wows = [r["wow_change_pct"] for r in enriched if r["wow_change_pct"] is not None]
    avg_wow = round(sum(wows) / len(wows), 1) if wows else None

    # Trend across the full range (first half vs second half)
    trend = "stable"
    if len(enriched) >= 4:
        mid = len(enriched) // 2
        first_avg = sum(r["cases"] for r in enriched[:mid]) / mid
        second_avg = sum(r["cases"] for r in enriched[mid:]) / max(len(enriched) - mid, 1)
        if second_avg > first_avg * 1.10:
            trend = "rising"
        elif second_avg < first_avg * 0.90:
            trend = "falling"

    first_c = enriched[0]["cases"] if enriched else 0
    last_c = enriched[-1]["cases"] if enriched else 0
    period_change = (
        round(((last_c - first_c) / max(first_c, 1)) * 100, 1) if first_c > 0 else 0.0
    )

    start_label = f"{start_year}-W{start_week:02d}"
    end_label = f"{end_year}-W{end_week:02d}"
    peak_label = (
        f"W{peak_entry['week']}/{peak_entry['year']}" if peak_entry else "N/A"
    )
    summary = (
        f"{district} ({start_label} → {end_label}): "
        f"{len(enriched)} weeks, {total_cases} total cases. "
        f"Peak: {peak_cases} cases at {peak_label}. "
        f"Period trend: {trend} "
        f"({'+' if period_change >= 0 else ''}{period_change}% start→end). "
        + (f"Avg WoW: {'+' if (avg_wow or 0) >= 0 else ''}{avg_wow}%." if avg_wow is not None else "")
    )

    return json.dumps(
        {
            "district": district,
            "date_range": {"start": start_label, "end": end_label},
            "weeks_in_range": len(enriched),
            "total_cases": total_cases,
            "peak_cases": peak_cases,
            "peak_entry": peak_entry,
            "avg_wow_pct": avg_wow,
            "trend_direction": trend,
            "period_change_pct": period_change,
            "weekly_data": enriched,
            "summary": summary,
        },
        indent=2,
        ensure_ascii=False,
    )


def get_year_over_year_comparison(district: str, years: int = 3) -> str:
    """Compare annual dengue totals for a district across multiple years.

    Use when the user asks "how does this year compare to last year?",
    "annual totals for Colombo", "is 2025 worse than previous years?",
    or any question about year-level aggregates rather than recent weeks.

    Args:
        district: District name.
        years: Number of past years to include in comparison (default 3).
    """
    years = max(1, min(int(years), 10))

    # Fetch most recent year (discovers the latest data year)
    recent_data = _api_get("/analytics/historical/yearly-summary")
    if not recent_data:
        return json.dumps({"error": "Failed to fetch yearly summary"})

    current_year = recent_data.get("year")
    if not current_year:
        return json.dumps({"error": "Could not determine current data year"})

    # Collect data for the requested years window
    yearly_results = []
    for y in range(current_year - years + 1, current_year + 1):
        data = recent_data if y == current_year else _api_get(
            "/analytics/historical/yearly-summary", {"year": y}
        )
        if not data:
            continue
        dist_entry = next(
            (d for d in data.get("districts", [])
             if d.get("district", "").lower() == district.strip().lower()),
            None,
        )
        if dist_entry:
            yearly_results.append({"year": data.get("year"), **dist_entry})

    if not yearly_results:
        return json.dumps({"error": f"No yearly data found for '{district}'"})

    yearly_results.sort(key=lambda r: r.get("year", 0))

    # Enrich with YoY change
    enriched = []
    for i, row in enumerate(yearly_results):
        prev_total = yearly_results[i - 1]["total_cases"] if i > 0 else None
        yoy_pct: float | None = None
        if prev_total is not None and prev_total > 0:
            yoy_pct = round(((row["total_cases"] - prev_total) / prev_total) * 100, 1)
        enriched.append({
            "year": row["year"],
            "total_cases": row["total_cases"],
            "avg_weekly_cases": round(row.get("avg_cases", 0) or 0, 1),
            "peak_week_cases": row.get("max_cases", 0),
            "weeks_reported": row.get("week_count", 0),
            "yoy_change_pct": yoy_pct,
        })

    # Overall multi-year trend (first vs last)
    trend = "stable"
    if len(enriched) >= 2:
        first_total = enriched[0]["total_cases"]
        last_total = enriched[-1]["total_cases"]
        if last_total > first_total * 1.15:
            trend = "worsening"
        elif last_total < first_total * 0.85:
            trend = "improving"

    best_year = min(enriched, key=lambda r: r["total_cases"])
    worst_year = max(enriched, key=lambda r: r["total_cases"])
    latest = enriched[-1]
    latest_yoy = latest.get("yoy_change_pct")
    yoy_str = (
        f"({'+' if (latest_yoy or 0) >= 0 else ''}{latest_yoy}% YoY)"
        if latest_yoy is not None
        else ""
    )

    summary = (
        f"{district} annual comparison ({enriched[0]['year']}–{enriched[-1]['year']}): "
        f"Latest ({latest['year']}): {latest['total_cases']} total cases {yoy_str}. "
        f"Worst year: {worst_year['year']} ({worst_year['total_cases']} cases). "
        f"Best year: {best_year['year']} ({best_year['total_cases']} cases). "
        f"Multi-year trend: {trend}."
    )

    return json.dumps(
        {
            "district": district,
            "years_compared": len(enriched),
            "year_range": {"start": enriched[0]["year"], "end": enriched[-1]["year"]},
            "annual_data": enriched,
            "best_year": best_year,
            "worst_year": worst_year,
            "multi_year_trend": trend,
            "summary": summary,
        },
        indent=2,
        ensure_ascii=False,
    )


# All tools available to the agent
ALL_TOOLS = [
    compare_districts,
    year_over_year,
    get_weather_correlation,
    get_outbreak_alerts,
    get_growth_rate,
    get_district_details,
    get_seasonal_pattern,
    get_cross_district_spillover,
    get_intervention_history,
    get_model_performance_metrics,
    get_demographic_hotspots,
    get_national_briefing,
    get_weekly_ml_forecast,
    get_rapid_hotspots,
    get_historical_range,
    get_year_over_year_comparison,
]
