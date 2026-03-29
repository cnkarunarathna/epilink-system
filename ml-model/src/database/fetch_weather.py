"""
Fetch historical weather data from Open-Meteo API including humidity.
This script populates/updates the weather_data table with complete weather information.
"""

import time
from datetime import datetime, timedelta
from pathlib import Path
import sys

import pandas as pd
import psycopg2
import requests
from tqdm import tqdm

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DB_CONFIG
from src.utils.districts import DISTRICT_COORDS

# Open-Meteo Archive API URL
ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive"


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(**DB_CONFIG)


def fetch_weather_for_district(district: str, start_date: str, end_date: str) -> dict:
    """
    Fetch historical weather data for a district from Open-Meteo Archive API.
    
    Returns dict of (year, week) -> (temp_mean, precip_sum, humidity_mean)
    """
    if district not in DISTRICT_COORDS:
        print(f"  Unknown district: {district}")
        return {}
    
    lat, lon = DISTRICT_COORDS[district]
    
    url = (
        f"{ARCHIVE_API}?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean"
        f"&timezone=Asia%2FColombo"
    )
    
    # Alternative URL with correct humidity variable name if the first fails
    url_alt = (
        f"{ARCHIVE_API}?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum"
        f"&timezone=Asia%2FColombo"
    )
    
    try:
        response = requests.get(url, timeout=60)
        
        # If humidity variable fails, try without it
        if response.status_code == 400:
            response = requests.get(url_alt, timeout=60)
        
        response.raise_for_status()
        data = response.json()
        
        if "daily" not in data:
            return {}
        
        # Create DataFrame
        df = pd.DataFrame(data["daily"])
        df["date"] = pd.to_datetime(df["time"])
        df["year"] = df["date"].dt.isocalendar().year
        df["week"] = df["date"].dt.isocalendar().week
        
        # Aggregate by ISO week
        agg_dict = {
            "temperature_2m_mean": "mean",
            "precipitation_sum": "sum",
        }
        # Check for any humidity column
        humidity_col = None
        for col in ["relative_humidity_2m_mean", "mean_relative_humidity_2m", "relative_humidity_2m"]:
            if col in df.columns:
                humidity_col = col
                agg_dict[col] = "mean"
                break
        
        weekly = df.groupby(["year", "week"]).agg(agg_dict).reset_index()
        
        # Convert to dictionary
        weather_dict = {}
        for _, row in weekly.iterrows():
            key = (int(row["year"]), int(row["week"]))
            humidity = 70.0  # Default
            if humidity_col and humidity_col in row:
                humidity = row[humidity_col]
                if pd.isna(humidity):
                    humidity = 70.0
            weather_dict[key] = (
                float(row["temperature_2m_mean"]),
                float(row["precipitation_sum"]),
                float(humidity),
            )
        
        return weather_dict
        
    except Exception as e:
        print(f"  Error fetching {district}: {e}")
        return {}


def fetch_and_store_historical_weather(start_year: int = 2020, end_year: int = None):
    """
    Fetch historical weather data for all districts and store in database.
    
    Args:
        start_year: Year to start fetching from (default: 2020)
        end_year: Year to end fetching (default: current year)
    """
    if end_year is None:
        end_year = datetime.now().year
    
    print("=" * 70)
    print("HISTORICAL WEATHER DATA FETCHER")
    print("=" * 70)
    print(f"\nFetching weather data from {start_year} to {end_year}")
    print("Including: temperature, precipitation, humidity")
    print()
    
    # Date range - end date must be in the past (archive API doesn't have future data)
    start_date = f"{start_year}-01-01"
    # Use yesterday as end date (archive API data is delayed by ~5 days)
    yesterday = datetime.now() - timedelta(days=5)
    end_date = yesterday.strftime("%Y-%m-%d")
    
    # Connect to database
    print("Connecting to database...")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        print("   Connected\n")
    except Exception as e:
        print(f"   Connection failed: {e}")
        return False
    
    # Get district IDs
    cur.execute("SELECT id, name FROM districts")
    district_map = {name: id for id, name in cur.fetchall()}
    
    if not district_map:
        print("   No districts found in database")
        cur.close()
        conn.close()
        return False
    
    print(f"Fetching data for {len(district_map)} districts...")
    print("-" * 70)
    
    total_records = 0
    
    for district, district_id in tqdm(district_map.items(), desc="Districts"):
        # Fetch weather from Open-Meteo
        weather_data = fetch_weather_for_district(district, start_date, end_date)
        
        if not weather_data:
            continue
        
        # Insert/update weather records
        for (year, week), (temp, precip, humidity) in weather_data.items():
            cur.execute(
                """
                INSERT INTO weather_data (district_id, year, week, temperature_2m_mean, precipitation_sum, relative_humidity_mean)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (district_id, year, week) 
                DO UPDATE SET 
                    temperature_2m_mean = EXCLUDED.temperature_2m_mean,
                    precipitation_sum = EXCLUDED.precipitation_sum,
                    relative_humidity_mean = EXCLUDED.relative_humidity_mean
                """,
                (district_id, year, week, round(temp, 2), round(precip, 2), round(humidity, 2)),
            )
            total_records += 1
        
        conn.commit()
        
        # Rate limiting - be nice to the API
        time.sleep(0.5)
    
    print("-" * 70)
    print(f"\nInserted/updated {total_records} weather records")
    
    # Verify
    cur.execute("SELECT COUNT(*) FROM weather_data WHERE relative_humidity_mean IS NOT NULL")
    humidity_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM weather_data")
    total_count = cur.fetchone()[0]
    
    print(f"\nDatabase Summary:")
    print(f"   Total weather records: {total_count}")
    print(f"   Records with humidity: {humidity_count}")
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("HISTORICAL WEATHER FETCH COMPLETE!")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch historical weather data from Open-Meteo")
    parser.add_argument("--start-year", type=int, default=2020, help="Start year (default: 2020)")
    parser.add_argument("--end-year", type=int, default=None, help="End year (default: current year)")
    
    args = parser.parse_args()
    
    success = fetch_and_store_historical_weather(args.start_year, args.end_year)
    sys.exit(0 if success else 1)
