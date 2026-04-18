# Tool Calling Enhancement Plan

This document describes eight new tools to add to the `AgenticInsightService` toolset,
ordered by implementation phase. Each phase is self-contained and can be merged independently.

---

## Current State (baseline)

| # | Tool | NestJS Endpoint | What it answers |
|---|------|-----------------|-----------------|
| 1 | `compare_districts` | `/analytics/historical/districts/compare` | Side-by-side district comparison |
| 2 | `year_over_year` | `/analytics/districts/{d}/timeseries` | Historical trend / seasonal overlay |
| 3 | `get_weather_correlation` | `/analytics/advanced/weather-correlation` | Rainfall/temp vs cases correlation |
| 4 | `get_outbreak_alerts` | `/analytics/advanced/outbreak-alerts` | Active alert status by district |
| 5 | `get_growth_rate` | `/analytics/advanced/growth-rate` | WoW growth rate and trajectory |
| 6 | `get_district_details` | `/analytics/districts/{d}/timeseries` | Deep single-district stats |
| 7 | `get_seasonal_pattern` | `/analytics/districts/{d}/timeseries` | Multi-year peak season analysis |
| 8 | `get_cross_district_spillover` | `/analytics/historical/districts/compare` | Neighbour spillover risk |
| 9 | `get_intervention_history` | `/analytics/districts/{d}/timeseries` | Inferred past response events |
| 10 | `get_model_performance_metrics` | `/analytics/districts/latest` + timeseries | Forecast vs actual accuracy |
| 11 | `get_demographic_hotspots` | `/analytics/districts/{d}/timeseries` | Sub-zone risk breakdown |

Key files:
- `explain-analytics/src/explain_analytics/services/tools.py`
- `explain-analytics/src/explain_analytics/services/insight_service.py`

---

## Phase 1 — National Situational Awareness ✅ DONE

**Goal:** Allow the chatbot to answer national-level questions across all 25 Sri Lanka districts
in a single call instead of requiring per-district queries.

**Problem today:** No tool aggregates data nationally. Asking "what is the current national
dengue situation?" forces Gemini to call `compare_districts` with an arbitrary district list,
which is incomplete and inefficient.

**New tool: `get_national_briefing`**

```
NestJS endpoint: GET /analytics/summary
```

**What to implement in `tools.py`:**

```python
def get_national_briefing() -> str:
    """Get a national-level dengue situation summary across all districts.

    Use this when the user asks about the overall/national situation, total case burden,
    how many districts are at high risk, or wants a country-wide briefing.
    No arguments needed.
    """
    data = _api_get("/analytics/summary")
    if not data:
        return json.dumps({"error": "Failed to fetch national summary"})

    # Extract and enrich key national indicators
    # Return: total_cases, high_risk_count, critical_count, top_hotspots,
    #         national_wow_pct, trend_direction, districts_rising/falling/stable
```

**FunctionDeclaration for Gemini (in `insight_service.py`):**

```python
_t.FunctionDeclaration(
    name="get_national_briefing",
    description=(
        "Get a national-level dengue situation summary across all Sri Lanka districts. "
        "Use for questions about the overall country situation, total case burden, "
        "how many districts are high-risk, or a national briefing. No parameters needed."
    ),
    parameters=_t.Schema(type=_t.Type.OBJECT, properties={}, required=[]),
)
```

**Register in `_build_tool_map`:**
```python
"get_national_briefing": get_national_briefing,
```

---

## Phase 2 — ML Forecast Surface ✅ DONE

**Goal:** Expose the backend's 1-week-ahead ML predictions to the chatbot so it can answer
forward-looking questions, not just retrospective analysis.

**Problem today:** `get_model_performance_metrics` shows past forecast accuracy but no tool
directly surfaces what the model *predicts for next week*. Users asking "what does the model
forecast for Kandy?" get no useful answer.

**New tool: `get_weekly_ml_forecast`**

```
NestJS endpoint: GET /analytics/advanced/weekly-forecast
```

**What to implement in `tools.py`:**

```python
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

    # Return: predicted_cases, prediction_confidence, forecast_week,
    #         comparison_to_current, trend_direction per district
```

**FunctionDeclaration for Gemini:**

```python
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
)
```

---

## Phase 3 — Rapid Geographic Hotspot Scan ✅ DONE

**Goal:** Give the chatbot a fast triage tool that identifies which districts need immediate
attention using the backend's dedicated hotspot algorithm (distinct from outbreak alerts).

**Problem today:** `get_outbreak_alerts` uses a ratio-based threshold (2× 4-week average).
The backend also has a separate `hotspots` endpoint that uses absolute magnitude + trajectory.
Chatbot cannot distinguish between "technically in outbreak" and "currently most critical".

**New tool: `get_rapid_hotspots`**

```
NestJS endpoint: GET /analytics/advanced/hotspots
```

**What to implement in `tools.py`:**

```python
def get_rapid_hotspots(top_n: int = 5) -> str:
    """Identify the top N dengue hotspot districts by current case magnitude and trajectory.

    Use when the user asks "where should resources be deployed?", "which districts are
    worst right now?", or needs a quick priority-ranked triage of all districts.
    Different from outbreak_alerts — ranks by absolute burden, not ratio thresholds.

    Args:
        top_n: Number of top hotspot districts to return (default 5, max 10).
    """
    data = _api_get("/analytics/advanced/hotspots")
    if not data:
        return json.dumps({"error": "Failed to fetch hotspot data"})

    # Rank by case magnitude + WoW trajectory
    # Return: ranked list with district, cases, wow_pct, hotspot_score, priority_action
```

**FunctionDeclaration for Gemini:**

```python
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
)
```

---

## Phase 4 — Custom Date-Range Analysis ✅ DONE

**Goal:** Remove the hardcoded 8–12 week lookback window so investigators can query
arbitrary epidemiological periods (e.g. a specific outbreak window, a monsoon season,
or a post-intervention evaluation period).

**Problem today:** All timeseries tools implicitly use the most recent N weeks. A user
asking "what happened between week 20 and week 35 in 2024?" gets no useful answer.

**New tool: `get_historical_range`**

```
NestJS endpoint: GET /analytics/historical/range
Params: startYear, startWeek, endYear, endWeek (all integers)
```

**What to implement in `tools.py`:**

```python
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
        "district": district,
        "startYear": start_year,
        "startWeek": start_week,
        "endYear": end_year,
        "endWeek": end_week,
    }
    data = _api_get("/analytics/historical/range", params)
    if not data:
        return json.dumps({"error": f"No data found for {district} in the specified range"})

    # Return: weekly timeseries, total cases in range, peak week, average WoW,
    #         trend summary across the range
```

**FunctionDeclaration for Gemini:**

```python
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
)
```

---

## Phase 5 — Year-over-Year Annual Comparison ✅ DONE

**Goal:** Provide a full-year aggregate view so the chatbot can answer policy-level questions
like "is 2025 worse than 2024?" without relying on the 12-week rolling window of `year_over_year`.

**Problem today:** `year_over_year` overlays weekly patterns across years but always anchors
to current week. No tool computes annual totals, yearly peaks, or multi-year trend direction.

**New tool: `get_year_over_year_comparison`**

```
NestJS endpoint: GET /analytics/historical/yearly-summary
Params: year (optional, returns current year if omitted)
```

**What to implement in `tools.py`:**

```python
def get_year_over_year_comparison(district: str, years: int = 3) -> str:
    """Compare annual dengue totals for a district across multiple years.

    Use when the user asks "how does this year compare to last year?",
    "annual totals for Colombo", "is 2025 worse than previous years?",
    or any question about year-level aggregates rather than recent weeks.

    Args:
        district: District name.
        years: Number of past years to include in comparison (default 3).
    """
    # Fetch yearly summaries for the last N years
    # Return: year, total_cases, peak_week, peak_cases, avg_weekly, yoy_change_pct
```

**FunctionDeclaration for Gemini:**

```python
_t.FunctionDeclaration(
    name="get_year_over_year_comparison",
    description=(
        "Compare annual dengue totals for a district across multiple years. Use when "
        "asked 'how does this year compare to last year?', 'annual totals', 'is 2025 "
        "worse than previous years?'. Different from seasonal pattern — this aggregates "
        "full calendar years, not weekly overlays."
    ),
    parameters=_t.Schema(
        type=_t.Type.OBJECT,
        properties={
            "district": _t.Schema(type=_t.Type.STRING, description="District name."),
            "years": _t.Schema(
                type=_t.Type.INTEGER,
                description="Number of past years to include (default 3).",
            ),
        },
        required=["district"],
    ),
)
```

---

## Phase 6 — Colombo Sub-District Breakdown ✅ DONE

**Goal:** Expose intra-district granularity for Colombo, Sri Lanka's largest and most
densely populated district, where aggregated district-level numbers hide critical
sub-district variation.

**Problem today:** Every tool treats Colombo as a single unit. A PHI supervisor asking
"which part of Colombo is worst?" gets no useful answer — the chatbot can only respond
with the district total.

**New tool: `get_colombo_ds_breakdown`**

```
NestJS endpoints:
  GET /analytics/colombo/ds-breakdown   (optional: year, week)
  GET /analytics/colombo/ds-breakdown/weights
```

**What to implement in `tools.py`:**

```python
def get_colombo_ds_breakdown(year: int = 0, week: int = 0) -> str:
    """Get dengue case breakdown by Divisional Secretariat (DS) zones within Colombo district.

    Use ONLY for Colombo-specific questions about sub-district geography:
    "which part of Colombo is most affected?", "DS zone breakdown in Colombo",
    "Colombo sub-district hotspots", or resource allocation within Colombo.

    Args:
        year: ISO year (default: current year).
        week: ISO week number (default: latest available week).
    """
    params = {}
    if year > 0:
        params["year"] = year
    if week > 0:
        params["week"] = week

    data = _api_get("/analytics/colombo/ds-breakdown", params or None)
    if not data:
        return json.dumps({"error": "Failed to fetch Colombo DS breakdown"})

    # Return: per-DS zone cases, risk level, allocation weight,
    #         ranked intervention priorities within Colombo
```

**FunctionDeclaration for Gemini:**

```python
_t.FunctionDeclaration(
    name="get_colombo_ds_breakdown",
    description=(
        "Get dengue case breakdown by Divisional Secretariat (DS) zones within Colombo. "
        "Use ONLY for Colombo sub-district questions: 'which part of Colombo is worst?', "
        "'DS zone breakdown', or resource allocation within Colombo. Not applicable to "
        "other districts."
    ),
    parameters=_t.Schema(
        type=_t.Type.OBJECT,
        properties={
            "year": _t.Schema(type=_t.Type.INTEGER, description="ISO year. Default: current year."),
            "week": _t.Schema(type=_t.Type.INTEGER, description="ISO week number. Default: latest."),
        },
        required=[],
    ),
)
```

---

## Phase 7 — Field Response Capacity ✅ DONE

**Goal:** Integrate field operations data (tasks + PHI workload) so the chatbot can answer
operational questions about whether the health system response is keeping pace with case burden.

**Problem today:** Analytics tools are purely surveillance-focused. The chatbot cannot
answer "are field teams coping in Kurunegala?" or "which district has the most
uninvestigated cases?". Tasks and user data exist in NestJS but are invisible to the agent.

**New tool: `get_field_response_capacity`**

```
NestJS endpoints:
  GET /tasks/stats (with districtId filter)
  GET /users?role=PHI&districtId=...
```

**What to implement in `tools.py`:**

```python
def get_field_response_capacity(district: str = "") -> str:
    """Get field team workload and response capacity for a district or nationally.

    Use when the user asks about operational response: "are field teams coping?",
    "how many uninvestigated cases in Kandy?", "PHI workload in Gampaha",
    "is the response capacity sufficient?", or "task completion rate".

    Args:
        district: District name. Empty string returns national overview.
    """
    # Fetch task stats (active, pending, completed) filtered by district
    # Fetch PHI count for district
    # Derive: cases_per_phi, task_backlog, completion_rate, capacity_status
    # Return: phi_count, active_tasks, pending_tasks, cases_per_phi,
    #         task_completion_rate, capacity_assessment (adequate/strained/overwhelmed)
```

**FunctionDeclaration for Gemini:**

```python
_t.FunctionDeclaration(
    name="get_field_response_capacity",
    description=(
        "Get field team (PHI) workload and response capacity for a district or nationally. "
        "Use when asked 'are field teams coping?', 'uninvestigated cases in X', "
        "'PHI workload', 'task completion rate', or 'is response capacity sufficient?'. "
        "Bridges surveillance data with operational response."
    ),
    parameters=_t.Schema(
        type=_t.Type.OBJECT,
        properties={
            "district": _t.Schema(
                type=_t.Type.STRING,
                description="District name. Leave empty for national overview.",
            ),
        },
        required=[],
    ),
)
```

---

## Phase 8 — National Intervention Effectiveness Scorecard ✅ DONE

**Goal:** Rank all districts by how effectively their field teams control outbreaks once
they begin — identifying which health divisions respond fastest and which need capacity support.

**Problem today:** `get_intervention_history` is single-district. No tool aggregates
intervention effectiveness nationally. The chatbot cannot answer "which districts are
best at controlling outbreaks once they start?".

**New tool: `evaluate_national_intervention_effectiveness`**

```
Data source: Aggregate get_intervention_history across all 25 districts
(no new NestJS endpoint required — batches existing timeseries calls)
```

**What to implement in `tools.py`:**

```python
def evaluate_national_intervention_effectiveness(top_n: int = 5) -> str:
    """Rank districts by how effectively they control dengue outbreaks once they start.

    Use when asked "which districts respond best to outbreaks?", "where is vector
    control most effective?", "show me intervention effectiveness nationally",
    or to identify districts that need response capacity support.

    Args:
        top_n: Number of top and bottom performers to include (default 5 each).

    Note: Makes multiple backend calls (one per district). Slightly slower than
    single-district tools.
    """
    # Loop through all 25 Sri Lanka districts
    # Call timeseries for each → extract response events (peak→trough sequences)
    # Rank by: avg_weeks_to_control, avg_decline_pct, response_event_count
    # Return: top_N best responders, bottom_N worst, national_avg_weeks_to_control
```

**FunctionDeclaration for Gemini:**

```python
_t.FunctionDeclaration(
    name="evaluate_national_intervention_effectiveness",
    description=(
        "Rank districts by how effectively they control dengue outbreaks. Use when asked "
        "'which districts respond best?', 'where is vector control most effective?', "
        "'show intervention effectiveness nationally', or to identify capacity gaps. "
        "Note: slower than single-district tools as it aggregates all 25 districts."
    ),
    parameters=_t.Schema(
        type=_t.Type.OBJECT,
        properties={
            "top_n": _t.Schema(
                type=_t.Type.INTEGER,
                description="Number of top and bottom performers to return (default 5 each).",
            ),
        },
        required=[],
    ),
)
```

---

## Implementation Order Summary

| Phase | Tool | Complexity | NestJS Dependency |
|-------|------|-----------|-------------------|
| 1 | `get_national_briefing` ✅ | Low | `GET /analytics/summary` |
| 2 | `get_weekly_ml_forecast` ✅ | Low | `GET /analytics/advanced/weekly-forecast` |
| 3 | `get_rapid_hotspots` ✅ | Low | `GET /analytics/advanced/hotspots` |
| 4 | `get_historical_range` ✅ | Low | `GET /analytics/historical/range` |
| 5 | `get_year_over_year_comparison` ✅ | Medium | `GET /analytics/historical/yearly-summary` |
| 6 | `get_colombo_ds_breakdown` ✅ | Medium | `GET /analytics/colombo/ds-breakdown` |
| 7 | `get_field_response_capacity` ✅ | Medium | `GET /public/analytics/field-capacity` |
| 8 | `evaluate_national_intervention_effectiveness` ✅ | High | Batches existing timeseries |

**Total new tools after all phases: 19 (11 existing + 8 new)**

---

## Gaps Fixed by This Plan

| Gap | Fixed by Phase |
|-----|----------------|
| No national aggregate view | 1, 3 |
| ML forecasts untapped | 2 |
| Hardcoded 8–12 week window | 4, 5 |
| Colombo sub-district invisible | 6 |
| Field operations invisible to chatbot | 7 |
| Can't identify best/worst responders nationally | 8 |
