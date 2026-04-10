# DS-Level Dengue Predictions for Colombo District

## Overview

Extend the existing district-level dengue forecasting model to produce Divisional Secretariat (DS) level case predictions for Colombo district using a two-stage spatial disaggregation pipeline.

**Approach:** District-level ML forecast → Spatial disaggregation using population density + historical burden weights

---

## Background

The current ML model (`ml-model/app.py`) predicts dengue cases at the district level for all 25 Sri Lankan districts. No DS-level training data exists in the current dataset (`data/srilanka_weekly_dengue.csv`). Since fine-grained historical data is unavailable, a **proportional disaggregation** approach is used — a recognized technique in epidemiological spatial downscaling.

### Colombo District — 13 DS Divisions
1. Colombo
2. Dehiwala
3. Moratuwa
4. Sri Jayawardenepura Kotte
5. Kaduwela
6. Kolonnawa
7. Thimbirigasyaya
8. Seethawaka
9. Padukka
10. Homagama
11. Kesbewa
12. Maharagama
13. Hanwella

---

## Disaggregation Weight Formula

Each DS division is assigned a composite weight from three factors:

| Factor | Basis | Contribution |
|--------|-------|-------------|
| Population proportion | Census 2012/2022 | 50% |
| Population density (urban risk proxy) | Population ÷ area (km²) | 30% |
| Historical relative dengue burden | NCDS annual reports / literature | 20% |

```
DS_weight[i] = normalize(0.5 × pop_prop[i] + 0.3 × density_score[i] + 0.2 × burden_score[i])

DS_predicted_cases[i] = colombo_district_cases × DS_weight[i]
```

All weights sum to 1.0 across the 13 DS divisions.

---

## Implementation Plan

### Phase 1 — Weight Configuration

**File:** `ml-model/src/config/colombo_ds_weights.py`

- Define static weight table for all 13 DS divisions
- Include population, area, density, and historical burden scores (sourced from Census 2012/2022 and NCDS reports)
- Compute and store normalized final weights
- Add source citations as comments

---

### Phase 2 — Disaggregation Logic

**File:** `ml-model/src/forecasting/ds_disaggregation.py`

- `compute_ds_breakdown(district_cases: float) -> list[dict]`
  - Applies weights to distribute the Colombo district total
  - Returns per-DS-division case estimates with confidence interval scaling
  - Assigns risk level to each DS division using existing `classify_risk()` thresholds

---

### Phase 3 — Backend Endpoint (NestJS)

> **Architecture note:** The weekly pipeline already stores the Colombo district prediction in the `weekly_forecasts` table. DS-level breakdown is pure deterministic math (`cases × weight[i]`), so it is computed at serve-time in the backend — no ML model call, no new DB table, no pipeline changes.

**Files:**
- `backend/src/analytics/colombo-ds-weights.ts` — static weight table (TS constant mirroring the Python config)
- `backend/src/analytics/analytics.service.ts` — add `getColombosDsBreakdown()` method
- `backend/src/analytics/analytics.controller.ts` — expose new endpoint

**New endpoint:**
```
GET /analytics/colombo/ds-breakdown?year=2026&week=15
```

**Service logic (`getColombosDsBreakdown`):**
1. Query `weekly_forecasts` for Colombo district at the requested year/week (defaults to latest)
2. Extract `predicted_cases`, `uncertainty_lower`, `uncertainty_upper`
3. Apply DS weights from `colombo-ds-weights.ts` in-memory
4. Return sorted breakdown

**Response shape:**
```json
{
  "district": "Colombo",
  "year": 2026,
  "week": 15,
  "district_predicted_cases": 142,
  "disaggregation_method": "population_density_burden_weighted",
  "ds_breakdown": [
    {
      "ds_division": "Thimbirigasyaya",
      "predicted_cases": 24,
      "proportion": 0.166,
      "risk_level": "high",
      "confidence_interval": { "lower": 16, "upper": 31 }
    },
    ...
  ]
}
```

Results sorted by predicted cases descending.

---

### Phase 4 — Frontend Visualization

**Location:** Frontend dashboard — Colombo district detail view

- Choropleth map of Colombo district DS divisions colored by risk level
- Tooltip on hover: DS division name, predicted cases, risk level, CI range
- Bar chart showing ranked DS divisions by case count
- Data fetched from `GET /analytics/colombo/ds-breakdown` (backend, not ML model)

**GeoJSON source:** Colombo DS division boundaries from GADM v4.1 or OpenStreetMap administrative level 6

---

### Phase 5 — Validation & Documentation

- Add a `GET /analytics/colombo/ds-breakdown/weights` endpoint to expose the weight table (academic transparency)
- Write unit tests for the backend `getColombosDsBreakdown()` method
- Write unit tests for Python `compute_ds_breakdown()` in `ml-model`
- Add academic framing note: *"Two-stage pipeline: district-level XGBoost ensemble forecast + spatial disaggregation using population density and historical dengue burden weights"*

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `ml-model/src/config/colombo_ds_weights.py` | ✅ Created | Static weight table with cited sources (Python) |
| `ml-model/src/forecasting/ds_disaggregation.py` | ✅ Created | Disaggregation logic + risk classification (Python) |
| `backend/src/analytics/colombo-ds-weights.ts` | Create | Weight table as TS constant (mirrors Python config) |
| `backend/src/analytics/analytics.service.ts` | Edit | Add `getColombosDsBreakdown()` method |
| `backend/src/analytics/analytics.controller.ts` | Edit | Add `GET /analytics/colombo/ds-breakdown` endpoint |
| `backend/src/analytics/analytics.controller.ts` | Edit | Add `GET /analytics/colombo/ds-breakdown/weights` endpoint |
| Frontend (TBD) | Create | Colombo DS choropleth map component |

**No changes needed to:**
- `ml-model/src/forecasting/weekly.py` — pipeline unchanged
- `ml-model/app.py` — ML API unchanged
- DB schema — no new tables

---

## Data Sources

- **Population data:** Census of Population and Housing 2012, Department of Census and Statistics, Sri Lanka
- **Area data:** Administrative boundaries, Survey Department of Sri Lanka
- **Historical dengue burden:** NCDS (National Dengue Control Unit) annual surveillance reports
- **GeoJSON boundaries:** GADM v4.1 or OpenStreetMap administrative level 6

---

## Academic Framing

> "Where DS-level surveillance data is unavailable, we apply a spatial disaggregation model that distributes district-level ML predictions to sub-district administrative units using a composite weight derived from population proportion (50%), population density (30%), and historical dengue burden (20%). This approach is consistent with established methods in disease burden estimation and small-area estimation literature."

---

## Status

- [x] Phase 1 — Weight configuration
- [x] Phase 2 — Disaggregation logic
- [ ] Phase 3 — API endpoint
- [ ] Phase 4 — Frontend visualization
- [ ] Phase 5 — Validation & documentation
