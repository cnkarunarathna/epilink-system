"""
Backfill Humidity and Wind Speed Data

This script fetches historical humidity and wind speed data from Open-Meteo
and updates both the database and local weather cache files.

Usage:
    python backfill_humidity.py              # Backfill all data
    python backfill_humidity.py --db-only    # Only update database
    python backfill_humidity.py --csv-only   # Only update CSV cache files
"""

import os
import sys
import time
import argparse
import pandas as pd
import requests
from datetime import datetime
from tqdm import tqdm

# Try to import database config
try:
    import psycopg2
    from config import DB_CONFIG
    HAS_DB = True
except ImportError:
    HAS_DB = False
    print("Database config not available. Will only update CSV files.")


# District coordinates
DISTRICT_COORDS = {
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

# Data range
START_DATE = "2020-01-01"
END_DATE = "2025-01-01"

# Weather data directory
WEATHER_DIR = "data/weather_data"


def fetch_humidity_data(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Fetch humidity and wind speed data from Open-Meteo archive API.
    
    Args:
        lat: Latitude
        lon: Longitude
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        
    Returns:
        DataFrame with weekly humidity and wind speed data
    """
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max"
        f"&timezone=Asia%2FColombo"
    )
    
    try:
        response = requests.get(url, timeout=30)
        data = response.json()
        
        if "daily" not in data:
            return pd.DataFrame()
        
        # Create daily DataFrame
        df = pd.DataFrame(data["daily"])
        df["date"] = pd.to_datetime(df["time"])
        df["year"] = df["date"].dt.year
        df["week"] = df["date"].dt.isocalendar().week.astype(int)
        
        # Aggregate to weekly
        weekly = df.groupby(["year", "week"]).agg({
            "temperature_2m_mean": "mean",
            "precipitation_sum": "sum",
            "relative_humidity_2m_mean": "mean",
            "wind_speed_10m_max": "max",
        }).reset_index()
        
        # Rename columns
        weekly = weekly.rename(columns={
            "relative_humidity_2m_mean": "relative_humidity_mean",
            "wind_speed_10m_max": "wind_speed_max",
        })
        
        return weekly
        
    except Exception as e:
        print(f"   API error: {e}")
        return pd.DataFrame()


def update_csv_files():
    """Update local CSV weather cache files with humidity data."""
    print("\nUpdating CSV Weather Cache Files")
    print("=" * 50)
    
    os.makedirs(WEATHER_DIR, exist_ok=True)
    
    updated_count = 0
    
    for district, (lat, lon) in tqdm(DISTRICT_COORDS.items(), desc="Fetching weather"):
        cache_file = os.path.join(WEATHER_DIR, f"{district}_weather.csv")
        
        # Fetch full data (including humidity)
        weather_df = fetch_humidity_data(lat, lon, START_DATE, END_DATE)
        
        if weather_df.empty:
            print(f"   No data fetched for {district}")
            continue
        
        # Save to CSV
        weather_df.to_csv(cache_file, index=False)
        updated_count += 1
        
        # Polite delay to respect API rate limits
        time.sleep(0.5)
    
    print(f"\nUpdated {updated_count} CSV files")
    return updated_count


def update_database():
    """Update database with humidity and wind speed data."""
    if not HAS_DB:
        print("Database not configured. Skipping database update.")
        return 0
    
    print("\nUpdating Database")
    print("=" * 50)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get district mapping
        cur.execute("SELECT id, name FROM districts")
        districts = {name: district_id for district_id, name in cur.fetchall()}
        
        updated_count = 0
        
        for district, (lat, lon) in tqdm(DISTRICT_COORDS.items(), desc="Updating DB"):
            if district not in districts:
                continue
            
            district_id = districts[district]
            
            # Fetch humidity data
            weather_df = fetch_humidity_data(lat, lon, START_DATE, END_DATE)
            
            if weather_df.empty:
                continue
            
            # Update each record
            for _, row in weather_df.iterrows():
                cur.execute("""
                    UPDATE weather_data 
                    SET relative_humidity_mean = %s,
                        wind_speed_max = %s
                    WHERE district_id = %s 
                      AND year = %s 
                      AND week = %s
                """, (
                    float(row["relative_humidity_mean"]) if pd.notna(row["relative_humidity_mean"]) else None,
                    float(row["wind_speed_max"]) if pd.notna(row["wind_speed_max"]) else None,
                    district_id,
                    int(row["year"]),
                    int(row["week"]),
                ))
                
                # If no row updated, insert new record
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO weather_data 
                        (district_id, year, week, temperature_2m_mean, precipitation_sum, 
                         relative_humidity_mean, wind_speed_max)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (district_id, year, week) DO UPDATE SET
                            relative_humidity_mean = EXCLUDED.relative_humidity_mean,
                            wind_speed_max = EXCLUDED.wind_speed_max
                    """, (
                        district_id,
                        int(row["year"]),
                        int(row["week"]),
                        float(row["temperature_2m_mean"]) if pd.notna(row["temperature_2m_mean"]) else None,
                        float(row["precipitation_sum"]) if pd.notna(row["precipitation_sum"]) else None,
                        float(row["relative_humidity_mean"]) if pd.notna(row["relative_humidity_mean"]) else None,
                        float(row["wind_speed_max"]) if pd.notna(row["wind_speed_max"]) else None,
                    ))
            
            conn.commit()
            updated_count += 1
            
            # Polite delay
            time.sleep(0.5)
        
        # Verify update
        cur.execute("""
            SELECT COUNT(*) FROM weather_data 
            WHERE relative_humidity_mean IS NOT NULL
        """)
        humidity_count = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COUNT(*) FROM weather_data 
            WHERE wind_speed_max IS NOT NULL
        """)
        wind_count = cur.fetchone()[0]
        
        print(f"\nDatabase Statistics:")
        print(f"   Records with humidity: {humidity_count}")
        print(f"   Records with wind speed: {wind_count}")
        
        cur.close()
        conn.close()
        
        print(f"\nUpdated {updated_count} districts in database")
        return updated_count
        
    except Exception as e:
        print(f"Database error: {e}")
        return 0


def verify_data():
    """Verify that humidity data was successfully backfilled."""
    print("\nVerifying Backfill")
    print("=" * 50)
    
    # Check CSV files
    csv_with_humidity = 0
    for district in DISTRICT_COORDS:
        cache_file = os.path.join(WEATHER_DIR, f"{district}_weather.csv")
        if os.path.exists(cache_file):
            df = pd.read_csv(cache_file)
            if "relative_humidity_mean" in df.columns and df["relative_humidity_mean"].notna().any():
                csv_with_humidity += 1
    
    print(f"   CSV files with humidity: {csv_with_humidity}/{len(DISTRICT_COORDS)}")
    
    # Check database
    if HAS_DB:
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            
            cur.execute("""
                SELECT d.name, 
                       COUNT(*) as total,
                       COUNT(w.relative_humidity_mean) as with_humidity
                FROM weather_data w
                JOIN districts d ON w.district_id = d.id
                GROUP BY d.name
                ORDER BY d.name
            """)
            
            results = cur.fetchall()
            
            print("\n   Database records per district:")
            for name, total, with_humidity in results[:5]:
                print(f"      {name}: {with_humidity}/{total} with humidity")
            if len(results) > 5:
                print(f"      ... and {len(results) - 5} more districts")
            
            cur.close()
            conn.close()
            
        except Exception as e:
            print(f"   Could not verify database: {e}")


def main():
    parser = argparse.ArgumentParser(description="Backfill humidity and wind speed data")
    parser.add_argument("--db-only", action="store_true", help="Only update database")
    parser.add_argument("--csv-only", action="store_true", help="Only update CSV files")
    args = parser.parse_args()
    
    print("=" * 60)
    print("EpiLink Weather Data Backfill")
    print("   Fetching humidity and wind speed from Open-Meteo")
    print(f"   Date range: {START_DATE} to {END_DATE}")
    print(f"   Districts: {len(DISTRICT_COORDS)}")
    print("=" * 60)
    
    start_time = datetime.now()
    
    if args.db_only:
        update_database()
    elif args.csv_only:
        update_csv_files()
    else:
        # Update both
        update_csv_files()
        update_database()
    
    verify_data()
    
    elapsed = datetime.now() - start_time
    
    print("\n" + "=" * 60)
    print(f"Backfill complete!")
    print(f"   Time elapsed: {elapsed}")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Re-train model:  ./train_enhanced.sh")
    print("  2. Or with tuning:  ./train_enhanced.sh --tune")


if __name__ == "__main__":
    main()
