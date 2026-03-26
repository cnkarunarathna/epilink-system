"""Custom Agno tools that call back to the NestJS backend for live data.

Each tool returns pre-analyzed, structured output that the LLM can
directly reference in its response — no raw-data interpretation needed.
"""

import json
import httpx

from explain_analytics.config import settings

_TIMEOUT = 15


def _api_get(path: str, params: dict | None = None) -> dict | list | None:
    """Helper: GET from the NestJS backend, return parsed JSON or None."""
    try:
        url = f"{settings.backend_api_url}{path}"
        resp = httpx.get(url, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def compare_districts(districts: str) -> str:
    """Compare dengue statistics across multiple districts side-by-side.

    Use this tool when the user asks to compare two or more districts,
    e.g. "How does Colombo compare to Gampaha?" or "Compare the top 3 districts".

    Args:
        districts: Comma-separated district names, e.g. "Colombo,Gampaha,Kandy"

    Returns:
        A structured comparison table with cases, trends, and risk levels.
    """
    data = _api_get(
        "/analytics/historical/districts/compare",
        {"districts": districts},
    )
    if not data:
        return json.dumps({"error": "Failed to fetch comparison data"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No data available for the requested districts"})

    # Pre-analyze: produce a concise comparison summary
    summary_rows = []
    for row in rows[:10]:
        name = row.get("district") or row.get("name", "Unknown")
        cases = row.get("cases") or row.get("predicted_cases", 0)
        summary_rows.append({
            "district": name,
            "cases": cases,
            "year": row.get("year"),
            "week": row.get("week"),
            "temperature": row.get("temperature_2m_mean"),
            "precipitation": row.get("precipitation_sum"),
        })

    # Sort by cases descending
    summary_rows.sort(key=lambda r: r.get("cases") or 0, reverse=True)

    if len(summary_rows) >= 2:
        top = summary_rows[0]
        analysis = (
            f"Highest: {top['district']} with {top['cases']} cases. "
            f"Ratio of highest to lowest: "
            f"{(top['cases'] / max(summary_rows[-1]['cases'], 1)):.1f}×"
        )
    else:
        analysis = "Single district data returned."

    return json.dumps(
        {"comparison": summary_rows, "analysis": analysis},
        indent=2, ensure_ascii=False,
    )


def year_over_year(district: str) -> str:
    """Get year-over-year timeseries for a district to analyze trends.

    Use this tool when the user asks about historical comparison,
    e.g. "How does this compare to last year?" or "Show the trend".

    Args:
        district: Name of the district to analyze, e.g. "Colombo"

    Returns:
        Recent timeseries data with computed week-over-week changes.
    """
    data = _api_get(f"/analytics/districts/{district}/timeseries")
    if not data:
        return json.dumps({"error": f"No timeseries data for {district}"})

    rows = data if isinstance(data, list) else []
    if not rows:
        return json.dumps({"info": f"No historical data available for {district}"})

    # Take recent 8 weeks and compute WoW changes
    recent = rows[-8:] if len(rows) > 8 else rows
    enriched = []
    for i, row in enumerate(recent):
        cases = row.get("cases", 0) or 0
        prev_cases = recent[i - 1].get("cases", 0) if i > 0 else None
        wow_change = None
        if prev_cases is not None and prev_cases > 0:
            wow_change = round(((cases - prev_cases) / prev_cases) * 100, 1)
        enriched.append({
            "year": row.get("year"),
            "week": row.get("week"),
            "cases": cases,
            "wow_change_pct": wow_change,
            "temperature": row.get("temperature"),
            "precipitation": row.get("precipitation"),
        })

    # Summary analysis
    if len(enriched) >= 2:
        first_cases = enriched[0]["cases"]
        last_cases = enriched[-1]["cases"]
        overall_change = (
            round(((last_cases - first_cases) / max(first_cases, 1)) * 100, 1)
        )
        direction = "rising" if overall_change > 10 else "falling" if overall_change < -10 else "stable"
        analysis = (
            f"{district}: {first_cases} → {last_cases} cases over {len(enriched)} weeks "
            f"({'+' if overall_change > 0 else ''}{overall_change}%, {direction})"
        )
    else:
        analysis = f"Limited data for {district}."

    return json.dumps(
        {
            "district": district,
            "total_records": len(rows),
            "recent_weeks": enriched,
            "trend_analysis": analysis,
        },
        indent=2, ensure_ascii=False,
    )


def get_weather_correlation() -> str:
    """Fetch weather-dengue correlation analysis for all districts.

    Use this when the user asks about weather impact, climate factors,
    rainfall correlation, or temperature effects on dengue transmission.

    Returns:
        Weather correlation data with analytical summary.
    """
    data = _api_get("/analytics/advanced/weather-correlation")
    if not data:
        return json.dumps({"error": "Weather correlation data unavailable"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No weather correlation data available"})

    # Extract key weather-dengue insights
    results = []
    for row in rows[:15]:
        results.append({
            "district": row.get("district") or row.get("name", "Unknown"),
            "cases": row.get("cases"),
            "temperature": row.get("temperature_2m_mean") or row.get("temperature"),
            "precipitation": row.get("precipitation_sum") or row.get("precipitation"),
        })

    # Find extremes
    high_rain = [r for r in results if (r.get("precipitation") or 0) > 80]
    high_temp = [r for r in results if (r.get("temperature") or 0) > 29]

    analysis_parts = []
    if high_rain:
        names = ", ".join(r["district"] for r in high_rain[:3])
        analysis_parts.append(f"High rainfall (>80mm): {names} — elevated vector breeding risk")
    if high_temp:
        names = ", ".join(r["district"] for r in high_temp[:3])
        analysis_parts.append(f"High temperature (>29°C): {names} — accelerated mosquito lifecycle")

    return json.dumps(
        {
            "correlations": results,
            "weather_insights": analysis_parts or ["No extreme weather conditions detected"],
        },
        indent=2, ensure_ascii=False,
    )


def get_outbreak_alerts() -> str:
    """Fetch current outbreak alert status for all districts.

    Use this when the user asks about ongoing outbreaks, alerts, or
    which districts are currently in an outbreak state.

    Returns:
        Outbreak alert data with severity classification.
    """
    data = _api_get("/analytics/advanced/outbreak-alerts")
    if not data:
        return json.dumps({"error": "Outbreak alert service unavailable"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No outbreak alerts at this time"})

    alerts = []
    for row in rows[:15]:
        alerts.append({
            "district": row.get("district") or row.get("name", "Unknown"),
            "alert_level": row.get("alert_level") or row.get("severity", "unknown"),
            "cases": row.get("cases") or row.get("recent_cases"),
            "consecutive_weeks_rising": row.get("consecutive_weeks_rising"),
        })

    active = [a for a in alerts if a.get("alert_level") in ("high", "critical", "warn", "warning")]
    summary = f"{len(active)} active alerts out of {len(alerts)} districts monitored."

    return json.dumps(
        {"alerts": alerts, "summary": summary},
        indent=2, ensure_ascii=False,
    )


def get_growth_rate(weeks: int = 4) -> str:
    """Fetch case growth rate analysis to find accelerating districts.

    Use this when the user asks about acceleration, growth rate,
    or which districts are seeing the fastest increase or decrease.

    Args:
        weeks: Number of weeks to analyze growth over (default: 4)

    Returns:
        Growth rate data sorted by fastest-growing districts.
    """
    data = _api_get("/analytics/advanced/growth-rate", {"weeks": str(weeks)})
    if not data:
        return json.dumps({"error": "Growth rate data unavailable"})

    rows = data if isinstance(data, list) else [data]
    if not rows:
        return json.dumps({"info": "No growth rate data available"})

    rates = []
    for row in rows[:15]:
        rates.append({
            "district": row.get("district") or row.get("name", "Unknown"),
            "growth_rate_pct": row.get("growth_rate") or row.get("growth_rate_pct"),
            "current_cases": row.get("current_cases") or row.get("cases"),
            "previous_cases": row.get("previous_cases"),
        })

    # Sort by growth rate descending
    rates.sort(key=lambda r: r.get("growth_rate_pct") or 0, reverse=True)

    accelerating = [r for r in rates if (r.get("growth_rate_pct") or 0) > 15]
    decelerating = [r for r in rates if (r.get("growth_rate_pct") or 0) < -10]

    analysis = (
        f"{len(accelerating)} districts accelerating (>15% growth), "
        f"{len(decelerating)} decelerating (<-10% decline) over {weeks} weeks."
    )

    return json.dumps(
        {"growth_rates": rates, "analysis": analysis},
        indent=2, ensure_ascii=False,
    )


# All tools available to the agent
ALL_TOOLS = [
    compare_districts,
    year_over_year,
    get_weather_correlation,
    get_outbreak_alerts,
    get_growth_rate,
]
