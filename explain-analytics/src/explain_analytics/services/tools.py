"""Custom Agno tools that call back to the NestJS backend for live data.

Each tool returns pre-analyzed, structured output that the LLM can
directly reference in its response — no raw-data interpretation needed.
"""

import json
from collections import defaultdict

import httpx

from explain_analytics.config import settings

_TIMEOUT = 15


def _internal_headers() -> dict:
    if settings.backend_service_key:
        return {"x-internal-api-key": settings.backend_service_key}
    return {}


def _api_get(path: str, params: dict | None = None) -> dict | list | None:
    """Helper: GET from the NestJS backend, return parsed JSON or None."""
    try:
        url = f"{settings.backend_api_url}{path}"
        resp = httpx.get(url, params=params, headers=_internal_headers(), timeout=_TIMEOUT)
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
            else "high"
            if latest_cases >= 50
            else "moderate"
            if latest_cases >= 25
            else "low"
        )

        summaries.append({
            "district": dist_name,
            "current_cases": latest_cases,
            "prev_week_cases": (d_rows[-2].get("cases", 0) or 0) if len(d_rows) >= 2 else None,
            "wow_change_pct": wow,
            "avg_4week_cases": avg_4w,
            "case_trajectory": trajectory_str,
            "temperature_c": latest.get("temperature"),
            "precipitation_mm": latest.get("precipitation"),
            "risk_level": risk,
        })

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
        {"comparison": summaries, "analysis": analysis, "districts_analyzed": len(summaries)},
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
        enriched.append({
            "year": row.get("year"),
            "week": row.get("week"),
            "cases": cases,
            "wow_change_pct": wow_change,
            "temperature_c": row.get("temperature"),
            "precipitation_mm": row.get("precipitation"),
        })

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
        + (f". Momentum: {'+' if (momentum_pct or 0) >= 0 else ''}{momentum_pct}% (recent 2w vs first 2w)" if momentum_pct is not None else "")
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
            "strong" if abs(temp_corr) > 0.7
            else "moderate" if abs(temp_corr) > 0.4
            else "weak"
        )
        precip_strength = (
            "strong" if abs(precip_corr) > 0.7
            else "moderate" if abs(precip_corr) > 0.4
            else "weak"
        )

        results.append({
            "district": row.get("district", "Unknown"),
            "temp_correlation": round(temp_corr, 3),
            "temp_strength": temp_strength,
            "precip_correlation": round(precip_corr, 3),
            "precip_strength": precip_strength,
            "avg_cases": round(row.get("avg_cases", 0) or 0, 1),
            "avg_temp_c": round(row.get("avg_temp", 0) or 0, 1),
            "avg_precip_mm": round(row.get("avg_precip", 0) or 0, 1),
            "data_points": row.get("data_points", 0),
        })

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
            "insights": insights or ["No significant weather-dengue correlations detected"],
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
        return json.dumps({"info": "No outbreak alerts — all districts within normal range."})

    _severity_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}

    alerts = []
    for row in rows[:25]:
        current = row.get("current_cases", 0) or 0
        avg = row.get("avg_cases", 0) or 0.0
        ratio = round(current / avg, 1) if avg > 0 else None

        alerts.append({
            "district": row.get("district", "Unknown"),
            "alert_level": row.get("alert_level", "Normal"),
            "severity": row.get("severity", "moderate"),
            "current_cases": current,
            "avg_4week_cases": round(avg, 1),
            "ratio_to_4week_avg": ratio,
            "description": row.get("description", ""),
        })

    # Sort by severity then by cases
    alerts.sort(key=lambda a: (_severity_order.get(a["severity"], 3), -a["current_cases"]))

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
        rates.append({
            "district": row.get("district", "Unknown"),
            "avg_growth_rate_pct": round(growth, 1),
            "trend": row.get("trend", "stable"),
            "current_cases": current,
            "prev_cases": prev,
            "absolute_change": current - prev,
        })

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
        best_declining = min(decelerating, key=lambda r: r.get("avg_growth_rate_pct") or 0)
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
        enriched.append({
            "year": row.get("year"),
            "week": row.get("week"),
            "cases": cases,
            "wow_change_pct": wow,
            "temperature_c": row.get("temperature"),
            "precipitation_mm": row.get("precipitation"),
        })

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
        "critical" if latest_cases >= 100
        else "high" if latest_cases >= 50
        else "moderate" if latest_cases >= 25
        else "low"
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


# All tools available to the agent
ALL_TOOLS = [
    compare_districts,
    year_over_year,
    get_weather_correlation,
    get_outbreak_alerts,
    get_growth_rate,
    get_district_details,
]
