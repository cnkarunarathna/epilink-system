"""
Backfill Predictions Script
Fills the gap between last historical data and current week with iterative predictions.
Uses the trained model to generate predictions and stores them in the database.
"""

import psycopg2
import joblib
import os
import sys
from datetime import datetime, timedelta
import requests
import time
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


def fetch_weather_bulk(lat, lon, start_date, end_date):
    """Fetch weather data for entire date range and return weekly aggregates."""
    import pandas as pd

    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum"
        f"&timezone=Asia%2FColombo"
    )

    try:
        r = requests.get(url, timeout=30)
        data = r.json()

        if "daily" not in data:
            return {}

        # Create DataFrame and aggregate to weekly
        df = pd.DataFrame(data["daily"])
        df["date"] = pd.to_datetime(df["time"])
        df["year"] = df["date"].dt.isocalendar().year
        df["week"] = df["date"].dt.isocalendar().week

        # Aggregate by ISO week
        weekly = (
            df.groupby(["year", "week"])
            .agg({"temperature_2m_mean": "mean", "precipitation_sum": "sum"})
            .reset_index()
        )

        # Convert to dictionary for easy lookup
        weather_dict = {}
        for _, row in weekly.iterrows():
            key = (int(row["year"]), int(row["week"]))
            weather_dict[key] = (
                float(row["temperature_2m_mean"]),
                float(row["precipitation_sum"]),
            )

        return weather_dict
    except Exception:
        return {}


def fetch_weather_historical(lat, lon, start_date, end_date):
    """Fetch historical weather data for a date range (fallback for single week)."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum"
        f"&timezone=Asia%2FColombo"
    )

    try:
        r = requests.get(url, timeout=30)
        data = r.json()

        if "daily" in data and len(data["daily"]["temperature_2m_mean"]) > 0:
            temp_mean = sum(data["daily"]["temperature_2m_mean"]) / len(
                data["daily"]["temperature_2m_mean"]
            )
            precip_sum = sum(data["daily"]["precipitation_sum"])
            return temp_mean, precip_sum
    except Exception:
        pass

    # Fallback
    return 27.0, 100.0


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
    cases_mean_4w,
    temperature,
    precipitation,
    model_type="legacy",
):
    """Predict dengue cases for next week."""
    import pandas as pd

    # Create feature dictionary (numeric only)
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

    if model_type == "enhanced":
        # Enhanced ensemble model - predict directly
        prediction = model.predict(df)[0]
    else:
        # Legacy XGBoost model - ensure all features are present
        model_features = model.get_booster().feature_names
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        df = df[model_features]
        prediction = model.predict(df)[0]
    
    return max(0, prediction)


def backfill_predictions():
    """Backfill predictions from last database record to current week."""

    print("=" * 70)
    print("BACKFILL PREDICTIONS - CLOSING THE GAP")
    print("=" * 70)

    # Load model - use legacy XGBoost for simple backfilling
    # (Enhanced model requires full feature engineering pipeline)
    print("\nLoading model...")
    model = None
    model_type = "legacy"
    model_path = None
    
    # Check legacy model paths
    if LEGACY_MODEL_PATH.exists():
        model = joblib.load(LEGACY_MODEL_PATH)
        model_path = LEGACY_MODEL_PATH
    elif LEGACY_MODEL_PATH_ALT.exists():
        model = joblib.load(LEGACY_MODEL_PATH_ALT)
        model_path = LEGACY_MODEL_PATH_ALT
    
    if model is None:
        print(f"Legacy model not found!")
        print(f"   Checked: {LEGACY_MODEL_PATH}")
        print(f"   Checked: {LEGACY_MODEL_PATH_ALT}")
        print(f"\nRun './scripts/setup/setup_all.sh' to train the legacy model")
        return False

    print(f"   Legacy model loaded from {model_path}")

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

    # Determine current week (using ISO calendar correctly)
    today = datetime.now()
    iso_calendar = today.isocalendar()
    current_year = iso_calendar[0]
    current_week = iso_calendar[1]

    print(f"\nCurrent week: Week {current_week}/{current_year}")

    # Backfill for each district (check gaps per district)
    total_inserted = 0
    total_weeks_filled = 0

    print(f"\nBackfilling predictions for {len(DISTRICTS)} districts...")
    print("=" * 70)

    for district_idx, district in enumerate(DISTRICTS, 1):
        if district not in district_map:
            print(f"{district_idx:2d}. {district:20} Not in database")
            continue

        district_id = district_map[district]
        lat, lon = district_coords[district]

        print(f"\n{district_idx:2d}. {district}")
        print(f"    {'─' * 60}")

        # Get initial last 4 weeks from database for THIS district
        last_y, last_w, cases_history = get_last_4_weeks_from_db(conn, district_id)

        if cases_history is None:
            print(f"    Insufficient historical data (need 4 weeks)")
            continue

        print(f"    Last data: Week {last_w}/{last_y}")

        # Calculate weeks to fill for THIS district
        start_year, start_week = get_next_week(last_y, last_w)

        weeks_to_fill = []
        year, week = start_year, start_week

        while True:
            # Stop once we move past the current ISO week; include the current week itself
            if year > current_year or (year == current_year and week > current_week):
                break

            weeks_to_fill.append((year, week))
            year, week = get_next_week(year, week)

        if not weeks_to_fill:
            print(f"    Already up to date")
            continue

        print(
            f"    Need to fill: {len(weeks_to_fill)} weeks (Week {weeks_to_fill[0][1]}/{weeks_to_fill[0][0]} to Week {weeks_to_fill[-1][1]}/{weeks_to_fill[-1][0]})"
        )

        # Batch fetch weather data for all weeks at once
        if weeks_to_fill:
            first_start, _ = get_week_dates(weeks_to_fill[0][0], weeks_to_fill[0][1])
            _, last_end = get_week_dates(weeks_to_fill[-1][0], weeks_to_fill[-1][1])

            print(f"    Fetching weather data ({first_start} to {last_end})...")
            weather_cache = fetch_weather_bulk(lat, lon, first_start, last_end)
            print(f"    Weather data cached for {len(weather_cache)} weeks")
        else:
            weather_cache = {}

        # Iterate through weeks to backfill
        for week_idx, (year, week) in enumerate(weeks_to_fill, 1):
            # Get weather from cache or use fallback
            if (year, week) in weather_cache:
                temperature, precipitation = weather_cache[(year, week)]
            else:
                temperature, precipitation = 27.0, 100.0

            # Calculate lag features
            cases_lag1 = cases_history[-1]
            cases_lag2 = cases_history[-2]
            cases_lag3 = cases_history[-3]
            cases_mean_4w = sum(cases_history[-4:]) / 4

            # Predict
            predicted_cases = predict_next_week(
                model,
                district,
                cases_lag1,
                cases_lag2,
                cases_lag3,
                cases_mean_4w,
                temperature,
                precipitation,
                model_type=model_type,
            )

            # Insert into database
            cur.execute(
                """
                INSERT INTO dengue_cases (district_id, year, week, cases)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (district_id, year, week) 
                DO UPDATE SET 
                    cases = EXCLUDED.cases,
                    created_at = CURRENT_TIMESTAMP
                """,
                (district_id, year, week, int(round(predicted_cases))),
            )

            # Insert weather data
            cur.execute(
                """
                INSERT INTO weather_data (district_id, year, week, temperature_2m_mean, precipitation_sum)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (district_id, year, week) 
                DO UPDATE SET 
                    temperature_2m_mean = EXCLUDED.temperature_2m_mean,
                    precipitation_sum = EXCLUDED.precipitation_sum,
                    created_at = CURRENT_TIMESTAMP
                """,
                (
                    district_id,
                    year,
                    week,
                    round(temperature, 2),
                    round(precipitation, 2),
                ),
            )

            # Update history for next iteration
            cases_history.append(predicted_cases)
            if len(cases_history) > 4:
                cases_history.pop(0)

            total_inserted += 1
            total_weeks_filled += 1

            # Show progress
            if week_idx % 5 == 0 or week_idx == len(weeks_to_fill):
                print(
                    f"    Week {week:2d}/{year} -> {predicted_cases:5.1f} cases  [{week_idx}/{len(weeks_to_fill)} weeks]"
                )

        # Commit after each district
        conn.commit()
        print(f"    Completed {len(weeks_to_fill)} weeks")

    print("\n" + "=" * 70)
    print(f"\nBACKFILL SUMMARY")
    print(f"   Weeks per district: varied by district")
    print(f"   Districts processed: {len([d for d in DISTRICTS if d in district_map])}")
    print(f"   Total records inserted: {total_inserted}")
    print(f"   Database updated: Yes")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("BACKFILL COMPLETE!")
    print("=" * 70)
    print("\nNext steps:")
    print("   - Your database is now up to date until the current week")
    print("   - You can now run generate_weekly_forecast.py for future predictions")
    print("   - Set up GitHub Actions to run it weekly")

    return True


if __name__ == "__main__":
    success = backfill_predictions()
    if not success:
        exit(1)
