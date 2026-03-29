"""
Weekly Forecast Generator - Database to Database
Reads last 4 weeks from database, predicts next week, stores in database.
Designed to run weekly via GitHub Actions.

Enhancement 6: Also computes and stores uncertainty bounds and SHAP-based
feature importances in the weekly_forecasts table for the Explainable
Analytics service.
"""

import json
import psycopg2
import joblib
import os
import sys
from datetime import datetime, timedelta
import requests
import numpy as np
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DB_CONFIG
from src.utils.districts import DISTRICTS, DISTRICT_COORDS

# Model paths - check enhanced first, then legacy
ENHANCED_MODEL_PATH = PROJECT_ROOT / "models" / "enhanced" / "dengue_ensemble_model.pkl"
LEGACY_MODEL_PATH = PROJECT_ROOT / "models" / "dengue_xgb_model.pkl"
LEGACY_MODEL_PATH_ALT = PROJECT_ROOT / "models" / "legacy" / "dengue_xgb_model.pkl"

# Alias for backward compatibility
district_coords = DISTRICT_COORDS


def get_next_week(year, week):
    """Calculate next week and year, properly handling 53-week years."""
    from datetime import datetime, timedelta

    # Get the Monday of the current ISO week
    jan_4 = datetime(year, 1, 4)
    week_start = jan_4 + timedelta(days=jan_4.weekday() * -1, weeks=week - 1)

    # Add 7 days to get next week
    next_week_start = week_start + timedelta(days=7)

    # Get ISO calendar for next week
    next_iso = next_week_start.isocalendar()
    return next_iso[0], next_iso[1]


def get_week_dates(year, week):
    """Get start and end dates for a given week."""
    jan_4 = datetime(year, 1, 4)
    week_start = jan_4 + timedelta(days=jan_4.weekday() * -1, weeks=week - 1)
    week_end = week_start + timedelta(days=6)
    return week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")


def fetch_all_weather_forecasts(start_date, end_date):
    """Fetch weather forecast for all districts at once."""
    import time

    print(f"\nPre-fetching weather data for all {len(DISTRICTS)} districts...")
    weather_cache = {}
    successful = 0
    failed = 0

    for district in DISTRICTS:
        lat, lon = district_coords[district]
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
            f"&start_date={start_date}&end_date={end_date}"
            f"&daily=temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean"
            f"&timezone=Asia%2FColombo"
        )

        # Retry up to 3 times with exponential backoff
        for attempt in range(3):
            try:
                r = requests.get(url, timeout=30)
                data = r.json()

                if "daily" in data:
                    temp_mean = sum(data["daily"]["temperature_2m_mean"]) / len(
                        data["daily"]["temperature_2m_mean"]
                    )
                    precip_sum = sum(data["daily"]["precipitation_sum"])
                    # Get humidity if available
                    humidity = 70.0  # Default
                    if "relative_humidity_2m_mean" in data["daily"]:
                        humidity = sum(data["daily"]["relative_humidity_2m_mean"]) / len(
                            data["daily"]["relative_humidity_2m_mean"]
                        )
                    weather_cache[district] = (temp_mean, precip_sum, humidity)
                    successful += 1
                    break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2**attempt)
                elif attempt == 2:
                    # Use fallback on final failure
                    weather_cache[district] = (27.0, 100.0, 70.0)
                    failed += 1

        # Small delay between requests
        time.sleep(0.2)

    print(f"   Fetched: {successful}/{len(DISTRICTS)} districts")
    if failed > 0:
        print(f"   Using fallback for {failed} districts")

    return weather_cache


def get_last_4_weeks_from_db(conn, district_id):
    """Get last 4 weeks of dengue cases from database."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT year, week, cases
        FROM dengue_cases
        WHERE district_id = %s
        ORDER BY year DESC, week DESC
        LIMIT 4
        """,
        (district_id,),
    )

    rows = cur.fetchall()
    cur.close()

    if len(rows) < 4:
        return None, None, None

    # Reverse to get chronological order (oldest to newest)
    rows = rows[::-1]

    last_year, last_week = rows[-1][0], rows[-1][1]
    cases_history = [row[2] for row in rows]

    return last_year, last_week, cases_history


def predict_next_week(
    model,
    district,
    cases_lag1,
    cases_lag2,
    cases_lag3,
    cases_lag4,
    temperature,
    precipitation,
    humidity=None,
    week=1,
    model_type="legacy",
    feature_engineer=None,
):
    """Predict dengue cases for next week.
    
    Args:
        model: Trained model (ensemble or XGBoost)
        district: District name
        cases_lag1-4: Cases from previous 1-4 weeks
        temperature: Weekly mean temperature
        precipitation: Weekly precipitation sum
        humidity: Weekly mean humidity (optional, for enhanced model)
        week: Week number (1-52)
        model_type: "enhanced" or "legacy"
        feature_engineer: FeatureEngineer instance (for enhanced model)
    """
    import pandas as pd

    if model_type == "enhanced" and feature_engineer is not None:
        # Use feature engineer to create all 60+ features
        df = feature_engineer.prepare_for_prediction(
            district=district,
            cases_lag1=cases_lag1,
            cases_lag2=cases_lag2,
            cases_lag3=cases_lag3,
            cases_lag4=cases_lag4,
            temperature=temperature,
            precipitation=precipitation,
            humidity=humidity,
            week=week,
        )
        # Drop columns that model wasn't trained on
        cols_to_drop = ["district", "week", "population_density", "month_approx"]
        df = df.drop(columns=[c for c in cols_to_drop if c in df.columns], errors="ignore")
        
        # Reorder columns to match model's expected feature order
        if hasattr(model, 'feature_names') and model.feature_names:
            # Only keep features that the model expects, in the right order
            available = [c for c in model.feature_names if c in df.columns]
            df = df[available]
        
        prediction = model.predict(df)[0]
    else:
        # Legacy XGBoost model - simple features
        cases_mean_4w = (cases_lag1 + cases_lag2 + cases_lag3 + cases_lag4) / 4
        features = {
            "cases_lag1": cases_lag1,
            "cases_lag2": cases_lag2,
            "cases_lag3": cases_lag3,
            "cases_mean_4w": cases_mean_4w,
            "temperature_2m_mean": temperature,
            "precipitation_sum": precipitation,
        }

        df = pd.DataFrame([features])

        # One-hot encode district
        for d in DISTRICTS:
            df[f"district_{d}"] = 1 if d == district else 0

        # Ensure all model features are present
        model_features = model.get_booster().feature_names
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        df = df[model_features]
        prediction = model.predict(df)[0]
    
    return max(0, prediction)


# Maximum expected weekly cases used to normalize raw counts to a [0, 1]
# risk score.  Calibrated so that 100 cases/week ≈ 0.83 (near "critical")
# and 200 cases/week clips to 1.0.
_MAX_CASES_NORMALIZATION = 120.0


def _cases_to_risk(cases: float) -> float:
    """Normalize a raw case count to a risk score in [0, 1]."""
    return float(min(1.0, max(0.0, cases / _MAX_CASES_NORMALIZATION)))


def predict_with_full_metadata(
    model,
    district,
    cases_lag1,
    cases_lag2,
    cases_lag3,
    cases_lag4,
    temperature,
    precipitation,
    humidity,
    week,
    feature_engineer,
    shap_explainer=None,
) -> dict:
    """Run the enhanced ensemble and return point prediction + metadata.

    Returns a dict with:
        predicted_cases       — raw case count (int)
        model_risk_score      — normalised [0, 1] risk score
        uncertainty_lower     — lower 80 % CI as risk score
        uncertainty_upper     — upper 80 % CI as risk score
        feature_importances   — {feature: fraction} (top-10, SHAP-based if
                                available, otherwise ensemble importance)
    """
    import pandas as pd

    # Build feature DataFrame for the enhanced model
    df = feature_engineer.prepare_for_prediction(
        district=district,
        cases_lag1=cases_lag1,
        cases_lag2=cases_lag2,
        cases_lag3=cases_lag3,
        cases_lag4=cases_lag4,
        temperature=temperature,
        precipitation=precipitation,
        humidity=humidity,
        week=week,
    )
    cols_to_drop = ["district", "week", "population_density", "month_approx"]
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns], errors="ignore")
    if hasattr(model, "feature_names") and model.feature_names:
        available = [c for c in model.feature_names if c in df.columns]
        df = df[available]

    # Point estimate + uncertainty bounds (80 % CI from model disagreement)
    mean_pred, lower_pred, upper_pred = model.predict_with_uncertainty(df)
    predicted_cases = max(0.0, float(mean_pred[0]))

    # Feature importances — prefer SHAP, fall back to ensemble importance
    feature_importances: dict[str, float] = {}
    if shap_explainer is not None:
        try:
            shap_vals = shap_explainer(df)
            abs_vals = np.abs(shap_vals.values[0])
            total = abs_vals.sum()
            if total > 0:
                raw = {
                    feat: float(abs_vals[i] / total)
                    for i, feat in enumerate(df.columns)
                }
                # Keep top-10 features by contribution
                feature_importances = dict(
                    sorted(raw.items(), key=lambda x: x[1], reverse=True)[:10]
                )
        except Exception as shap_err:
            print(f"      SHAP error ({district}): {shap_err} — using ensemble importance")

    if not feature_importances:
        # Fallback: use the model's built-in feature importance
        try:
            fi_df = model.get_feature_importance()
            if not fi_df.empty:
                total = fi_df["mean_importance"].sum()
                if total > 0:
                    feature_importances = {
                        row["feature"]: float(row["mean_importance"] / total)
                        for _, row in fi_df.head(10).iterrows()
                    }
        except Exception:
            pass

    return {
        "predicted_cases": int(round(predicted_cases)),
        "model_risk_score": round(_cases_to_risk(predicted_cases), 4),
        "uncertainty_lower": round(_cases_to_risk(float(lower_pred[0])), 4),
        "uncertainty_upper": round(_cases_to_risk(float(upper_pred[0])), 4),
        "feature_importances": feature_importances,
    }


def generate_weekly_forecast():
    """Generate forecast for next week for all districts."""

    print("=" * 60)
    print("WEEKLY DENGUE FORECAST GENERATOR")
    print("=" * 60)

    # Load model - try enhanced first, then legacy
    print("\nLoading model...")
    model = None
    model_type = None
    model_path = None
    feature_engineer = None
    
    # Try enhanced model first
    if ENHANCED_MODEL_PATH.exists():
        try:
            from src.enhanced.ensemble_model import DengueEnsemblePredictor
            from src.enhanced.feature_engineering import FeatureEngineer

            model = DengueEnsemblePredictor.load(str(ENHANCED_MODEL_PATH))
            feature_engineer = FeatureEngineer(include_population=True)
            model_type = "enhanced"
            model_path = ENHANCED_MODEL_PATH
        except Exception as e:
            print(f"   Enhanced model failed: {e}")
            model = None

    # Build SHAP explainer for enhanced model (uses XGBoost sub-model)
    shap_explainer = None
    if model_type == "enhanced" and model is not None:
        try:
            import shap
            xgb_model = model.models.get("xgboost")
            if xgb_model is not None:
                shap_explainer = shap.TreeExplainer(xgb_model)
                print("   SHAP TreeExplainer initialised (XGBoost sub-model)")
        except Exception as shap_err:
            print(f"   SHAP unavailable: {shap_err} — feature importances will use ensemble importance")
    
    # Fall back to legacy model
    if model is None:
        if LEGACY_MODEL_PATH.exists():
            model = joblib.load(LEGACY_MODEL_PATH)
            model_path = LEGACY_MODEL_PATH
            model_type = "legacy"
        elif LEGACY_MODEL_PATH_ALT.exists():
            model = joblib.load(LEGACY_MODEL_PATH_ALT)
            model_path = LEGACY_MODEL_PATH_ALT
            model_type = "legacy"
    
    if model is None:
        print(f"No model found!")
        print(f"   Checked: {ENHANCED_MODEL_PATH}")
        print(f"   Checked: {LEGACY_MODEL_PATH}")
        print(f"\nRun './scripts/setup/setup_enhanced.sh' to train models")
        return False

    type_label = "Enhanced Ensemble" if model_type == "enhanced" else "Legacy XGBoost"
    print(f"   {type_label} loaded from {model_path}")

    # Connect to database
    print("\nConnecting to database...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("   Connected")
    except Exception as e:
        print(f"   Connection failed: {e}")
        return False

    # Get district mapping
    cur.execute("SELECT id, name FROM districts")
    district_map = {name: district_id for district_id, name in cur.fetchall()}

    # Determine next week
    today = datetime.now()
    iso_calendar = today.isocalendar()
    current_year = iso_calendar[0]  # Use ISO year, not calendar year
    current_week = iso_calendar[1]
    next_year, next_week = get_next_week(current_year, current_week)

    print(f"\nCurrent: Week {current_week}/{current_year}")
    print(f"Predicting: Week {next_week}/{next_year}")

    # Get dates for next week
    start_date, end_date = get_week_dates(next_year, next_week)
    print(f"   Date range: {start_date} to {end_date}")

    # Pre-fetch all weather data at once
    weather_cache = fetch_all_weather_forecasts(start_date, end_date)

    # Generate forecasts
    forecasts = []
    successful = 0

    print(f"\nGenerating forecasts for {len(DISTRICTS)} districts...")
    print("-" * 60)

    for i, district in enumerate(DISTRICTS, 1):
        if district not in district_map:
            print(f"{i:2d}. {district:20} Not in database")
            continue

        district_id = district_map[district]

        # Get last 4 weeks from database
        last_year, last_week, cases_history = get_last_4_weeks_from_db(
            conn, district_id
        )

        if cases_history is None:
            print(f"{i:2d}. {district:20} Insufficient data (need 4 weeks)")
            continue

        # Get weather forecast from pre-fetched cache (now includes humidity)
        weather = weather_cache.get(district, (27.0, 100.0, 70.0))
        temperature, precipitation, humidity = weather[0], weather[1], weather[2] if len(weather) > 2 else 70.0

        # Calculate lag features (need all 4 for enhanced model)
        cases_lag1 = cases_history[-1]
        cases_lag2 = cases_history[-2]
        cases_lag3 = cases_history[-3]
        cases_lag4 = cases_history[-4] if len(cases_history) >= 4 else cases_history[0]

        # Predict — enhanced model produces full metadata; legacy produces a scalar
        forecast_meta: dict = {}
        if model_type == "enhanced" and feature_engineer is not None:
            forecast_meta = predict_with_full_metadata(
                model=model,
                district=district,
                cases_lag1=cases_lag1,
                cases_lag2=cases_lag2,
                cases_lag3=cases_lag3,
                cases_lag4=cases_lag4,
                temperature=temperature,
                precipitation=precipitation,
                humidity=humidity,
                week=next_week,
                feature_engineer=feature_engineer,
                shap_explainer=shap_explainer,
            )
            predicted_cases = float(forecast_meta["predicted_cases"])
        else:
            predicted_cases = float(predict_next_week(
                model,
                district,
                cases_lag1,
                cases_lag2,
                cases_lag3,
                cases_lag4,
                temperature,
                precipitation,
                humidity=humidity,
                week=next_week,
                model_type=model_type,
                feature_engineer=feature_engineer,
            ))
            forecast_meta = {
                "predicted_cases": int(round(predicted_cases)),
                "model_risk_score": round(_cases_to_risk(predicted_cases), 4),
                "uncertainty_lower": None,
                "uncertainty_upper": None,
                "feature_importances": {},
            }

        forecasts.append(
            {
                "district_id": district_id,
                "district": district,
                "year": next_year,
                "week": next_week,
                "cases": int(round(predicted_cases)),
                "temperature": round(temperature, 2),
                "precipitation": round(precipitation, 2),
                "humidity": round(humidity, 2),
                # Enhancement 6 metadata
                "model_risk_score": forecast_meta.get("model_risk_score"),
                "uncertainty_lower": forecast_meta.get("uncertainty_lower"),
                "uncertainty_upper": forecast_meta.get("uncertainty_upper"),
                "feature_importances": forecast_meta.get("feature_importances") or {},
            }
        )

        uncertainty_str = ""
        if forecast_meta.get("uncertainty_lower") is not None:
            uncertainty_str = (
                f"  [CI: {forecast_meta['uncertainty_lower']:.2f}–{forecast_meta['uncertainty_upper']:.2f}]"
            )
        print(
            f"{i:2d}. {district:20} Predicted: {predicted_cases:.1f} cases"
            f"  risk={forecast_meta.get('model_risk_score', 0):.2f}{uncertainty_str}"
        )
        successful += 1

    print("-" * 60)
    print(f"Generated {successful} forecasts")

    # Insert into database
    if forecasts:
        print(f"\nSaving forecasts to database...")

        # Insert dengue_cases
        for f in forecasts:
            cur.execute(
                """
                INSERT INTO dengue_cases (district_id, year, week, cases)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (district_id, year, week) 
                DO UPDATE SET 
                    cases = EXCLUDED.cases,
                    created_at = CURRENT_TIMESTAMP
                """,
                (f["district_id"], f["year"], f["week"], f["cases"]),
            )

        # Insert weather_data (with humidity)
        for f in forecasts:
            cur.execute(
                """
                INSERT INTO weather_data (district_id, year, week, temperature_2m_mean, precipitation_sum, relative_humidity_mean)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (district_id, year, week) 
                DO UPDATE SET 
                    temperature_2m_mean = EXCLUDED.temperature_2m_mean,
                    precipitation_sum = EXCLUDED.precipitation_sum,
                    relative_humidity_mean = COALESCE(EXCLUDED.relative_humidity_mean, weather_data.relative_humidity_mean),
                    created_at = CURRENT_TIMESTAMP
                """,
                (
                    f["district_id"],
                    f["year"],
                    f["week"],
                    f["temperature"],
                    f["precipitation"],
                    f["humidity"],
                ),
            )

        # Insert weekly_forecasts (Enhancement 6 — uncertainty + feature importances)
        for f in forecasts:
            fi_json = json.dumps(f["feature_importances"]) if f["feature_importances"] else None
            cur.execute(
                """
                INSERT INTO weekly_forecasts (
                    district_id, year, week, predicted_cases,
                    model_risk_score, uncertainty_lower, uncertainty_upper,
                    feature_importances, model_type
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (district_id, year, week)
                DO UPDATE SET
                    predicted_cases    = EXCLUDED.predicted_cases,
                    model_risk_score   = EXCLUDED.model_risk_score,
                    uncertainty_lower  = EXCLUDED.uncertainty_lower,
                    uncertainty_upper  = EXCLUDED.uncertainty_upper,
                    feature_importances = EXCLUDED.feature_importances,
                    model_type         = EXCLUDED.model_type,
                    created_at         = CURRENT_TIMESTAMP
                """,
                (
                    f["district_id"],
                    f["year"],
                    f["week"],
                    f["cases"],
                    f["model_risk_score"],
                    f["uncertainty_lower"],
                    f["uncertainty_upper"],
                    fi_json,
                    model_type,
                ),
            )

        conn.commit()
        print(f"   Saved {len(forecasts)} dengue_cases records")
        print(f"   Saved {len(forecasts)} weather_data records")
        print(f"   Saved {len(forecasts)} weekly_forecasts records (with uncertainty + SHAP)")

    # Show summary
    print(f"\nSUMMARY")
    print(f"   Week predicted: {next_week}/{next_year}")
    print(f"   Districts: {successful}/{len(DISTRICTS)}")
    print(f"   Database updated: Yes")

    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print("FORECAST COMPLETE!")
    print("=" * 60)

    return True


if __name__ == "__main__":
    success = generate_weekly_forecast()
    if not success:
        exit(1)
