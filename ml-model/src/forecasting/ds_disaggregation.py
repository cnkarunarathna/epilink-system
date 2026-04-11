"""
DS-Level Spatial Disaggregation — Colombo District
====================================================

Distributes a district-level dengue case prediction for Colombo down to its
13 Divisional Secretariat (DS) divisions using pre-computed composite weights.

Disaggregation formula
----------------------
    DS_predicted_cases[i] = district_cases × DS_weight[i]

    DS_CI_lower[i]        = district_CI_lower × DS_weight[i]
    DS_CI_upper[i]        = district_CI_upper × DS_weight[i]

Weights are defined in src/config/colombo_ds_weights.py and combine:
    - Population proportion     (50 %)
    - Population density score  (30 %)
    - Historical dengue burden  (20 %)

Risk classification
-------------------
DS-level thresholds are purposely lower than district-level thresholds because
predictions represent a sub-district (~1/13th of district total on average).

    low      <  5 cases
    medium   5–14 cases
    high    15–24 cases
    critical >= 25 cases
"""

from __future__ import annotations

from src.config.colombo_ds_weights import DS_WEIGHTS, DS_WEIGHT_MAP

# ---------------------------------------------------------------------------
# DS-level risk thresholds
# ---------------------------------------------------------------------------

DS_RISK_THRESHOLDS: dict[str, int] = {
    "low": 5,
    "medium": 15,
    "high": 25,
}


def classify_ds_risk(cases: float) -> str:
    """Return a risk level string appropriate for a DS-division case count."""
    if cases < DS_RISK_THRESHOLDS["low"]:
        return "low"
    elif cases < DS_RISK_THRESHOLDS["medium"]:
        return "medium"
    elif cases < DS_RISK_THRESHOLDS["high"]:
        return "high"
    else:
        return "critical"


# ---------------------------------------------------------------------------
# Core disaggregation function
# ---------------------------------------------------------------------------

def compute_ds_breakdown(
    district_cases: float,
    ci_lower: float | None = None,
    ci_upper: float | None = None,
    confidence_level: float = 0.80,
) -> list[dict]:
    """
    Disaggregate a Colombo district-level prediction to DS-division level.

    Parameters
    ----------
    district_cases : float
        Predicted dengue cases for the whole Colombo district.
    ci_lower : float, optional
        Lower bound of the district-level confidence interval.
        If omitted, falls back to 70 % of district_cases.
    ci_upper : float, optional
        Upper bound of the district-level confidence interval.
        If omitted, falls back to 130 % of district_cases.
    confidence_level : float
        Confidence level of the interval passed in (default 0.80).

    Returns
    -------
    list[dict]
        One dict per DS division, sorted by predicted_cases descending.
        Each dict contains:
            ds_division      — name of the DS division
            predicted_cases  — integer point estimate
            proportion       — this DS division's share of the district total
            confidence_interval — {lower, upper, confidence_level}
            risk_level       — "low" | "medium" | "high" | "critical"
    """
    if district_cases < 0:
        raise ValueError(f"district_cases must be >= 0, got {district_cases}")

    # Fallback confidence bounds
    if ci_lower is None:
        ci_lower = district_cases * 0.70
    if ci_upper is None:
        ci_upper = district_cases * 1.30

    ci_lower = max(0.0, ci_lower)

    breakdown: list[dict] = []

    for ds in DS_WEIGHTS:
        weight = ds["weight"]
        ds_cases = district_cases * weight
        ds_lower = max(0.0, ci_lower * weight)
        ds_upper = ci_upper * weight

        breakdown.append({
            "ds_division": ds["name"],
            "predicted_cases": int(round(ds_cases)),
            "proportion": round(weight, 6),
            "confidence_interval": {
                "lower": int(round(ds_lower)),
                "upper": int(round(ds_upper)),
                "confidence_level": confidence_level,
            },
            "risk_level": classify_ds_risk(ds_cases),
        })

    # Sort highest predicted cases first
    breakdown.sort(key=lambda x: x["predicted_cases"], reverse=True)
    return breakdown


# ---------------------------------------------------------------------------
# Summary helpers
# ---------------------------------------------------------------------------

def get_hotspot_divisions(
    breakdown: list[dict],
    risk_levels: tuple[str, ...] = ("high", "critical"),
) -> list[dict]:
    """Return only DS divisions at or above the specified risk levels."""
    return [d for d in breakdown if d["risk_level"] in risk_levels]


def breakdown_summary(breakdown: list[dict]) -> dict:
    """
    Return a compact summary of a DS breakdown result.

    Includes total predicted cases, risk distribution, and the top hotspot.
    """
    risk_counts: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    total = 0

    for d in breakdown:
        risk_counts[d["risk_level"]] += 1
        total += d["predicted_cases"]

    top = breakdown[0] if breakdown else None

    return {
        "total_predicted_cases": total,
        "ds_division_count": len(breakdown),
        "risk_distribution": risk_counts,
        "top_hotspot": {
            "ds_division": top["ds_division"],
            "predicted_cases": top["predicted_cases"],
            "risk_level": top["risk_level"],
        } if top else None,
    }
