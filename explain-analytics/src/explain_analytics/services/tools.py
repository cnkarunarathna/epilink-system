"""Custom Agno tools that call back to the NestJS backend for live data."""

import json
import httpx

from explain_analytics.config import settings


def compare_districts(districts: str) -> str:
    """Compare dengue statistics across multiple districts.

    Use this tool when the user asks to compare two or more districts,
    e.g. "How does Colombo compare to Gampaha?" or "Compare the top 3 districts".

    Args:
        districts: Comma-separated district names, e.g. "Colombo,Gampaha,Kandy"

    Returns:
        JSON comparison of current predictions for the requested districts.
    """
    try:
        url = f"{settings.backend_api_url}/analytics/historical/districts/compare"
        resp = httpx.get(url, params={"districts": districts}, timeout=15)
        data = resp.json()
        if isinstance(data, list) and data:
            return json.dumps(data[:10], indent=2, ensure_ascii=False)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "tool": "compare_districts"})


def year_over_year(district: str) -> str:
    """Get year-over-year comparison for a district's dengue trends.

    Use this tool when the user asks about historical comparison,
    e.g. "How does this compare to last year?" or "What was the situation in 2024?".

    Args:
        district: Name of the district to analyze, e.g. "Colombo"

    Returns:
        JSON with the district's timeseries data for recent and past years.
    """
    try:
        url = f"{settings.backend_api_url}/analytics/districts/{district}/timeseries"
        resp = httpx.get(url, timeout=15)
        data = resp.json()
        if isinstance(data, list):
            # Return recent data summarized
            recent = data[-8:] if len(data) > 8 else data
            return json.dumps(
                {
                    "district": district,
                    "total_records": len(data),
                    "recent_weeks": recent,
                },
                indent=2,
                ensure_ascii=False,
            )
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "tool": "year_over_year"})


def get_weather_correlation() -> str:
    """Fetch weather-dengue correlation data for all districts.

    Use this when the user asks about weather impact, climate factors,
    rainfall correlation, or temperature effects on dengue transmission.

    Returns:
        JSON with weather correlation analysis across districts.
    """
    try:
        url = f"{settings.backend_api_url}/analytics/advanced/weather-correlation"
        resp = httpx.get(url, timeout=15)
        data = resp.json()
        if isinstance(data, list):
            return json.dumps(data[:15], indent=2, ensure_ascii=False)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "tool": "get_weather_correlation"})


def get_outbreak_alerts() -> str:
    """Fetch current outbreak alert status for all districts.

    Use this when the user asks about ongoing outbreaks, alerts, or
    which districts are currently in an outbreak state.

    Returns:
        JSON with outbreak alert data for districts.
    """
    try:
        url = f"{settings.backend_api_url}/analytics/advanced/outbreak-alerts"
        resp = httpx.get(url, timeout=15)
        data = resp.json()
        if isinstance(data, list):
            return json.dumps(data[:15], indent=2, ensure_ascii=False)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "tool": "get_outbreak_alerts"})


def get_growth_rate(weeks: int = 4) -> str:
    """Fetch case growth rate analysis across districts.

    Use this when the user asks about acceleration, growth rate,
    or which districts are seeing the fastest increase.

    Args:
        weeks: Number of weeks to analyze growth over (default: 4)

    Returns:
        JSON with growth rate data per district.
    """
    try:
        url = f"{settings.backend_api_url}/analytics/advanced/growth-rate"
        resp = httpx.get(url, params={"weeks": str(weeks)}, timeout=15)
        data = resp.json()
        if isinstance(data, list):
            return json.dumps(data[:15], indent=2, ensure_ascii=False)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "tool": "get_growth_rate"})


# All tools available to the agent
ALL_TOOLS = [
    compare_districts,
    year_over_year,
    get_weather_correlation,
    get_outbreak_alerts,
    get_growth_rate,
]
