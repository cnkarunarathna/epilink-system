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
13. Ratmalana

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

### Phase 3 — API Endpoint

**File:** `ml-model/app.py`

Add new endpoint:

```
GET /predict/colombo/ds-breakdown
```

**Query parameters:**
- `cases_lag1`, `cases_lag2`, `cases_lag3`, `cases_mean_4w` — lag features
- `temperature_2m_mean`, `precipitation_sum` — weather features

**Response shape:**
```json
{
  "district": "Colombo",
  "district_predicted_cases": 142,
  "ds_breakdown": [
    {
      "ds_division": "Colombo",
      "predicted_cases": 28,
      "proportion": 0.197,
      "risk_level": "high",
      "confidence_interval": { "lower": 19, "upper": 36 }
    },
    ...
  ],
  "model_version": "2.0.0",
  "disaggregation_method": "population_density_burden_weighted"
}
```

Results sorted by predicted cases descending.

---

### Phase 4 — Frontend Visualization

**Location:** Frontend dashboard (to be confirmed)

- Choropleth map of Colombo district DS divisions colored by risk level
- Tooltip on hover: DS division name, predicted cases, risk level
- Bar chart showing ranked DS divisions by case count
- Use GeoJSON boundary data for Colombo DS divisions

**GeoJSON source:** Colombo DS division boundaries from GADM / OpenStreetMap / Statistics Department SL

---

### Phase 5 — Validation & Documentation

- Document disaggregation assumptions and weight sources
- Add a `/predict/colombo/ds-breakdown/weights` endpoint to expose the weight table (useful for academic transparency)
- Write unit tests for the disaggregation logic
- Add academic framing note: *"Two-stage pipeline: district-level XGBoost ensemble forecast + spatial disaggregation using population density and historical dengue burden weights"*

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `ml-model/src/config/colombo_ds_weights.py` | Create | Static weight table with cited sources |
| `ml-model/src/forecasting/ds_disaggregation.py` | Create | Disaggregation logic |
| `ml-model/app.py` | Edit | Add `/predict/colombo/ds-breakdown` endpoint |
| `ml-model/app.py` | Edit | Add `/predict/colombo/ds-breakdown/weights` endpoint |
| Frontend (TBD) | Create | Colombo DS choropleth map component |

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

- [ ] Phase 1 — Weight configuration
- [ ] Phase 2 — Disaggregation logic
- [ ] Phase 3 — API endpoint
- [ ] Phase 4 — Frontend visualization
- [ ] Phase 5 — Validation & documentation
