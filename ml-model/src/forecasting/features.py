"""
Iterative Forecasting Script
Generates rolling predictions for the next 26 weeks (6 months ahead).
Updates weekly with new predictions based on latest historical data.
"""

import pandas as pd
import joblib
import os
from datetime import datetime, timedelta
import requests
import time


# CONFIGURATION
MODEL_PATH = "models/dengue_xgb_model.pkl"
DENGUE_FILE = "data/srilanka_weekly_dengue.csv"
OUTPUT_FILE = "data/forecast_features.csv"

DISTRICTS = [
    "Colombo",
    "Gampaha",
    "Kalutara",
    "Kandy",
    "Matale",
    "NuwaraEliya",
    "Galle",
    "Matara",
    "Hambanthota",
    "Jaffna",
    "Kilinochchi",
    "Mannar",
    "Vavuniya",
    "Mullaitivu",
    "Batticaloa",
    "Ampara",
    "Trincomalee",
    "Kurunegala",
    "Puttalam",
    "Anuradhapura",
    "Polonnaruwa",
    "Badulla",
    "Monaragala",
    "Ratnapura",
    "Kegalle",
]

# District coordinates for weather data
district_coords = {
    "Colombo": (6.9271, 79.8612),
    "Gampaha": (7.0917, 79.9994),
    "Kalutara": (6.5854, 79.9607),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "NuwaraEliya": (6.9497, 80.7891),
    "Galle": (6.0535, 80.2210),
    "Matara": (5.9549, 80.5550),
    "Hambanthota": (6.1248, 81.1010),
    "Jaffna": (9.6615, 80.0255),
    "Kilinochchi": (9.3951, 80.3987),
    "Mannar": (8.9770, 79.9046),
    "Vavuniya": (8.7514, 80.4970),
    "Mullaitivu": (9.2671, 80.8128),
    "Batticaloa": (7.7310, 81.6747),
    "Ampara": (7.3018, 81.6820),
    "Trincomalee": (8.5779, 81.2152),
    "Kurunegala": (7.4863, 80.3623),
    "Puttalam": (8.0400, 79.8390),
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Badulla": (6.9896, 81.0550),
    "Monaragala": (6.8710, 81.3487),
    "Ratnapura": (6.7056, 80.3847),
    "Kegalle": (7.2513, 80.3464),
}


def fetch_weather_for_date(lat, lon, start_date, end_date):
    """Fetch weather data for a specific date range."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum"
        f"&timezone=Asia%2FColombo"
    )
    r = requests.get(url)
    data = r.json()
    if "daily" not in data:
        return None, None

    temp_mean = sum(data["daily"]["temperature_2m_mean"]) / len(
        data["daily"]["temperature_2m_mean"]
    )
    precip_sum = sum(data["daily"]["precipitation_sum"])

    return temp_mean, precip_sum


def fetch_weather_bulk(lat, lon, start_date, end_date):
    """Fetch weather data for entire date range and aggregate to weekly."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum"
        f"&timezone=Asia%2FColombo"
    )
    r = requests.get(url)
    data = r.json()
    if "daily" not in data:
        return {}

    # Create DataFrame and aggregate to weekly
    w = pd.DataFrame(data["daily"])
    w["date"] = pd.to_datetime(w["time"])
    w["year"] = w["date"].dt.year
    w["week"] = w["date"].dt.isocalendar().week

    # Aggregate by week
    weekly = (
        w.groupby(["year", "week"])
        .agg({"temperature_2m_mean": "mean", "precipitation_sum": "sum"})
        .reset_index()
    )

    # Convert to dictionary for easy lookup
    weather_dict = {}
    for _, row in weekly.iterrows():
        key = (int(row["year"]), int(row["week"]))
        weather_dict[key] = {
            "temperature": float(row["temperature_2m_mean"]),
            "precipitation": float(row["precipitation_sum"]),
        }

    return weather_dict


def get_week_dates(year, week):
    """Get start and end dates for a given ISO week."""
    # ISO week date calculation
    jan4 = datetime(year, 1, 4)
    week_start = jan4 + timedelta(days=-jan4.weekday(), weeks=week - 1)
    week_end = week_start + timedelta(days=6)
    return week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")


def load_historical_data():
    """Load historical dengue data and calculate last known lag features."""
    df = pd.read_csv(DENGUE_FILE)
    df = df.sort_values(["district", "year", "week"])

    # Get the last 4 weeks for each district to calculate initial lags
    last_data = {}
    for district in DISTRICTS:
        district_data = df[df["district"] == district].tail(4)
        if len(district_data) >= 4:
            cases = district_data["cases"].tolist()
            last_year = district_data.iloc[-1]["year"]
            last_week = district_data.iloc[-1]["week"]

            last_data[district] = {
                "cases_history": cases,  # Last 4 weeks
                "last_year": int(last_year),
                "last_week": int(last_week),
            }

    return last_data


def predict_next_week(
    model,
    district,
    cases_lag1,
    cases_lag2,
    cases_lag3,
    cases_mean_4w,
    temperature,
    precipitation,
):
    """Make a prediction for one district for one week."""
    # Build feature dictionary
    features = {
        "cases_lag1": cases_lag1,
        "cases_lag2": cases_lag2,
        "cases_lag3": cases_lag3,
        "cases_mean_4w": cases_mean_4w,
        "temperature_2m_mean": temperature,
        "precipitation_sum": precipitation,
    }

    # Create DataFrame
    df = pd.DataFrame([features])

    # Add one-hot encoding for all districts
    for d in DISTRICTS:
        df[f"district_{d}"] = 1 if d == district else 0

    # Get model features and align
    model_features = model.get_booster().feature_names
    for col in model_features:
        if col not in df.columns:
            df[col] = 0

    df = df[model_features]

    # Predict
    prediction = model.predict(df)[0]
    return max(0, prediction)  # Can't have negative cases


def generate_iterative_forecast():
    """Generate rolling predictions for upcoming weeks (future forecasts)."""
    print("Loading model...")
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found at {MODEL_PATH}")
        print("Please train the model first using: python train_model.py")
        return

    model = joblib.load(MODEL_PATH)

    print("Loading historical data...")
    last_data = load_historical_data()

    # Determine current week
    today = datetime.now()
    current_year = today.year
    current_week = today.isocalendar()[1]

    print(
        f"Current date: {today.strftime('%Y-%m-%d')} (Year {current_year}, Week {current_week})"
    )

    # Forecast next 26 weeks (6 months ahead)
    FORECAST_WEEKS = 26
    print(f"Will forecast next {FORECAST_WEEKS} weeks into the future")

    # For each district, predict forward from last known week
    all_forecasts = []

    for district in DISTRICTS:
        if district not in last_data:
            print(f"No historical data for {district}, skipping...")
            continue

        print(f"\nForecasting {district}...")

        info = last_data[district]
        cases_history = info["cases_history"].copy()  # Last 4 weeks
        year = info["last_year"]
        week = info["last_week"]

        # Get district coordinates
        lat, lon = district_coords[district]

        # Fetch weather data for future weeks (forecast API for upcoming 16 days, then use historical averages)
        print(f"  Fetching weather forecast for {district}...")
        try:
            # Calculate future end date (26 weeks ahead)
            future_date = today + timedelta(weeks=FORECAST_WEEKS)
            end_date = min(future_date, today + timedelta(days=16)).strftime("%Y-%m-%d")
            # For near-term, use forecast API; for far future, we'll use historical averages
            weather_data = fetch_weather_bulk(
                lat, lon, today.strftime("%Y-%m-%d"), end_date
            )
            print(f"  Weather forecast loaded for near-term weeks")
        except Exception as e:
            print(f"  Weather fetch failed: {e}, will use historical averages")
            weather_data = {}

        # Predict next FORECAST_WEEKS weeks into the future
        week_count = 0

        while week_count < FORECAST_WEEKS:
            # Move to next week
            week += 1
            if week > 52:
                week = 1
                year += 1

            week_count += 1

            # Get weather data for this week from pre-fetched data
            start_date, end_date = get_week_dates(year, week)

            # Look up weather from bulk fetch
            if (year, week) in weather_data:
                temperature = weather_data[(year, week)]["temperature"]
                precipitation = weather_data[(year, week)]["precipitation"]
            else:
                # Use averages if not found
                temperature = 27.0
                precipitation = 100.0

            # Calculate lag features from history
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
            )

            # Update history
            cases_history.append(predicted_cases)
            if len(cases_history) > 4:
                cases_history.pop(0)  # Keep only last 4

            # Store forecast
            all_forecasts.append(
                {
                    "district": district,
                    "year": year,
                    "week": week,
                    "date_range": f"{start_date} to {end_date}",
                    "predicted_cases": round(predicted_cases, 2),
                    "cases_lag1": round(cases_lag1, 2),
                    "cases_lag2": round(cases_lag2, 2),
                    "cases_lag3": round(cases_lag3, 2),
                    "cases_mean_4w": round(cases_mean_4w, 2),
                    "temperature_2m_mean": round(temperature, 2),
                    "precipitation_sum": round(precipitation, 2),
                }
            )

            # Print every 10 weeks to reduce output
            if week_count % 10 == 0:
                print(
                    f"  Week {week}/{year}: {predicted_cases:.1f} cases (processed {week_count} weeks)"
                )

    # Save forecasts
    if all_forecasts:
        forecast_df = pd.DataFrame(all_forecasts)
        forecast_df.to_csv(OUTPUT_FILE, index=False)
        print(f"\nForecast saved to {OUTPUT_FILE}")
        print(f"   Total forecasts: {len(all_forecasts)}")
        print(f"   Districts: {forecast_df['district'].nunique()}")
        print(f"\nYou can now use this data to get lag features for predictions!")
    else:
        print("\nNo forecasts generated")


if __name__ == "__main__":
    generate_iterative_forecast()
