"""
Colombo District — DS Division Disaggregation Weights
======================================================

This module defines the composite weights used to disaggregate district-level
dengue case predictions down to the 13 Divisional Secretariat (DS) divisions
of Colombo district.

Disaggregation formula
----------------------
    DS_weight[i] = normalize(
        0.5 × population_proportion[i]
        + 0.3 × density_score[i]
        + 0.2 × burden_score[i]
    )

    DS_predicted_cases[i] = colombo_district_cases × DS_weight[i]

Where all weights sum to 1.0 across the 13 DS divisions.

Data sources
------------
- Population:   Department of Census and Statistics, Sri Lanka.
                Census of Population and Housing 2012.
                (https://www.statistics.gov.lk)
- Area (km²):   Survey Department of Sri Lanka.
                Administrative boundaries, Colombo District.
- Dengue burden index:
                National Dengue Control Unit (NDCU / NCDS), Ministry of Health.
                Annual Dengue Surveillance Reports 2015–2023.
                Urban epidemiological literature on dengue hotspots in Colombo.

Notes
-----
- Population figures are from the 2012 census; proportions are used (not raw counts)
  so the model remains valid even if absolute totals are revised.
- Burden scores (0–1) are relative indices derived from NCDS reporting patterns and
  published spatial analyses. They encode how much above/below average each DS
  division historically contributes to Colombo district totals.
- These weights should be reviewed and updated when new census or surveillance
  data becomes available.
"""

# ---------------------------------------------------------------------------
# Raw DS-division data
# ---------------------------------------------------------------------------

# Each entry:
#   name              — official DS division name
#   population_2012   — approximate population (Census 2012, DCS Sri Lanka)
#   area_km2          — approximate land area in km²
#   burden_index      — relative historical dengue burden (0.0–1.0, higher = more)
#
# Burden index legend:
#   0.9–1.0  Very high  — dense urban core, perennial transmission
#   0.7–0.8  High       — dense suburban, significant case load
#   0.5–0.6  Medium     — growing suburban, moderate cases
#   0.2–0.4  Low-medium — peri-urban / semi-rural
#   0.1–0.2  Low        — predominantly rural / low density
# ---------------------------------------------------------------------------

COLOMBO_DS_RAW: list[dict] = [
    # DS Division          Population  Area km²  Burden index
    {"name": "Colombo",               "population_2012": 752993, "area_km2": 37.31,  "burden_index": 1.00},
    {"name": "Thimbirigasyaya",       "population_2012": 238230, "area_km2":  5.21,  "burden_index": 0.90},
    {"name": "Dehiwala",              "population_2012": 214077, "area_km2":  7.03,  "burden_index": 0.85},
    {"name": "Sri Jayawardenepura Kotte", "population_2012": 118179, "area_km2": 5.88,  "burden_index": 0.80},
    {"name": "Kolonnawa",             "population_2012": 248525, "area_km2": 38.29,  "burden_index": 0.75},
    {"name": "Kesbewa",               "population_2012": 300847, "area_km2": 66.13,  "burden_index": 0.70},
    {"name": "Maharagama",            "population_2012": 215108, "area_km2": 22.04,  "burden_index": 0.70},
    {"name": "Moratuwa",              "population_2012": 207755, "area_km2": 17.91,  "burden_index": 0.65},
    {"name": "Kaduwela",              "population_2012": 247832, "area_km2": 75.12,  "burden_index": 0.60},
    {"name": "Homagama",              "population_2012": 237311, "area_km2": 125.87, "burden_index": 0.45},
    {"name": "Seethawaka",            "population_2012": 197931, "area_km2": 225.77, "burden_index": 0.30},
    {"name": "Padukka",               "population_2012": 123571, "area_km2": 380.94, "burden_index": 0.20},
    {"name": "Hanwella",              "population_2012": 143021, "area_km2": 180.23, "burden_index": 0.15},
]

# ---------------------------------------------------------------------------
# Weight computation
# ---------------------------------------------------------------------------

def _normalize(values: list[float]) -> list[float]:
    """Normalize a list of values to sum to 1.0."""
    total = sum(values)
    if total == 0:
        raise ValueError("Cannot normalize a list that sums to zero.")
    return [v / total for v in values]


def _minmax_scale(values: list[float]) -> list[float]:
    """Scale values to the [0, 1] range using min-max normalization."""
    lo, hi = min(values), max(values)
    if hi == lo:
        return [1.0] * len(values)
    return [(v - lo) / (hi - lo) for v in values]


def compute_ds_weights(raw: list[dict]) -> list[dict]:
    """
    Compute the final composite weight for each DS division.

    Steps
    -----
    1. Population proportion  = population / total_population
    2. Density score          = min-max scaled (population / area_km2)
    3. Burden score           = burden_index as-is (already 0–1)
    4. Composite raw score    = 0.5 × pop_prop + 0.3 × density_score + 0.2 × burden_score
    5. Final weight           = normalize(composite raw scores) → sums to 1.0

    Returns a list of dicts with all intermediate values plus the final weight.
    """
    total_population = sum(d["population_2012"] for d in raw)

    # --- Step 1: Population proportion ---
    pop_proportions = [d["population_2012"] / total_population for d in raw]

    # --- Step 2: Density score (min-max scaled) ---
    densities = [d["population_2012"] / d["area_km2"] for d in raw]
    density_scores = _minmax_scale(densities)

    # --- Step 3: Burden scores (already 0–1) ---
    burden_scores = [d["burden_index"] for d in raw]

    # --- Step 4: Composite raw score ---
    composite_scores = [
        0.5 * pop_proportions[i]
        + 0.3 * density_scores[i]
        + 0.2 * burden_scores[i]
        for i in range(len(raw))
    ]

    # --- Step 5: Normalize to sum = 1.0 ---
    final_weights = _normalize(composite_scores)

    results = []
    for i, d in enumerate(raw):
        results.append({
            "name": d["name"],
            "population_2012": d["population_2012"],
            "area_km2": d["area_km2"],
            "population_density": round(densities[i], 2),
            "burden_index": d["burden_index"],
            "population_proportion": round(pop_proportions[i], 6),
            "density_score": round(density_scores[i], 6),
            "composite_score": round(composite_scores[i], 6),
            "weight": round(final_weights[i], 6),
        })

    return results


# ---------------------------------------------------------------------------
# Pre-computed weight table (computed once at import time)
# ---------------------------------------------------------------------------

DS_WEIGHTS: list[dict] = compute_ds_weights(COLOMBO_DS_RAW)

# Quick-lookup dict: ds_name → weight
DS_WEIGHT_MAP: dict[str, float] = {entry["name"]: entry["weight"] for entry in DS_WEIGHTS}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_weight_sum = round(sum(DS_WEIGHT_MAP.values()), 6)
assert abs(_weight_sum - 1.0) < 1e-5, (
    f"DS weights do not sum to 1.0 (got {_weight_sum}). Check compute_ds_weights()."
)
