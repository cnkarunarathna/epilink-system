"""
Upload forecast data to existing dengue_cases and weather_data tables.
Inserts forecast data as regular records without schema changes.
"""

import psycopg2
import pandas as pd
import os
from config import DB_CONFIG


FORECAST_FILE = "data/forecast_features.csv"


def get_district_id_map(conn):
    """Get mapping of district names to IDs."""
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM districts")
    district_map = {name: district_id for district_id, name in cur.fetchall()}
    cur.close()
    return district_map


def upload_forecasts_to_db():
    """Upload forecast data from CSV to database tables."""

    if not os.path.exists(FORECAST_FILE):
        print(f"Forecast file not found: {FORECAST_FILE}")
        print("   Run 'python generate_forecast_features.py' first")
        return False

    print(f"Loading forecast data from {FORECAST_FILE}...")
    forecast_df = pd.read_csv(FORECAST_FILE)
    print(f"   Loaded {len(forecast_df)} forecast records")

    # Connect to database
    print("\nConnecting to database...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("   Connected successfully")
    except psycopg2.Error as e:
        print(f"   Database connection failed: {e}")
        return False

    # Get district ID mapping
    district_map = get_district_id_map(conn)
    print(f"   Found {len(district_map)} districts in database")

    # Prepare data for bulk insert
    print("\nPreparing forecast data...")
    dengue_records = []
    weather_records = []
    skipped = 0

    for _, row in forecast_df.iterrows():
        district_name = row["district"]

        if district_name not in district_map:
            print(f"   Unknown district: {district_name}")
            skipped += 1
            continue

        district_id = district_map[district_name]
        year = int(row["year"])
        week = int(row["week"])

        # Prepare dengue_cases record
        dengue_records.append(
            (district_id, year, week, int(round(float(row["predicted_cases"]))))
        )

        # Prepare weather_data record
        weather_records.append(
            (
                district_id,
                year,
                week,
                float(row["temperature_2m_mean"]),
                float(row["precipitation_sum"]),
            )
        )

    print(f"   Prepared {len(dengue_records)} dengue records")
    print(f"   Prepared {len(weather_records)} weather records")
    if skipped > 0:
        print(f"   Skipped {skipped} records due to unknown districts")

    # Insert dengue_cases using batch insert
    print("\nInserting dengue case forecasts...")

    try:
        # Use executemany for faster batch insert
        cur.executemany(
            """
            INSERT INTO dengue_cases (district_id, year, week, cases)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (district_id, year, week) 
            DO UPDATE SET 
                cases = EXCLUDED.cases,
                created_at = CURRENT_TIMESTAMP
        """,
            dengue_records,
        )

        conn.commit()
        print(f"   Processed {len(dengue_records)} dengue case records")
    except psycopg2.Error as e:
        print(f"   Error inserting dengue records: {e}")
        conn.rollback()
        return False

    # Insert weather_data using batch insert
    print("\nInserting weather forecasts...")

    try:
        # Use executemany for faster batch insert
        cur.executemany(
            """
            INSERT INTO weather_data (district_id, year, week, temperature_2m_mean, precipitation_sum)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (district_id, year, week) 
            DO UPDATE SET 
                temperature_2m_mean = EXCLUDED.temperature_2m_mean,
                precipitation_sum = EXCLUDED.precipitation_sum,
                created_at = CURRENT_TIMESTAMP
        """,
            weather_records,
        )

        conn.commit()
        print(f"   Processed {len(weather_records)} weather records")
    except psycopg2.Error as e:
        print(f"   Error inserting weather records: {e}")
        conn.rollback()
        return False

    # Show summary
    cur.execute(
        """
        SELECT 
            d.name,
            COUNT(DISTINCT dc.id) as case_count,
            COUNT(DISTINCT wd.id) as weather_count,
            MIN(dc.year || '-W' || LPAD(dc.week::text, 2, '0')) as earliest_week,
            MAX(dc.year || '-W' || LPAD(dc.week::text, 2, '0')) as latest_week
        FROM districts d
        LEFT JOIN dengue_cases dc ON d.id = dc.district_id AND dc.year = 2025 AND dc.week >= 12
        LEFT JOIN weather_data wd ON d.id = wd.district_id AND wd.year = 2025 AND wd.week >= 12
        WHERE dc.id IS NOT NULL OR wd.id IS NOT NULL
        GROUP BY d.name
        ORDER BY d.name
    """
    )

    print("\n2025 Forecast Data in Database (Week 12+):")
    results = cur.fetchall()
    if results:
        for district, case_count, weather_count, earliest, latest in results:
            print(
                f"   {district:20} Cases: {case_count:3}  Weather: {weather_count:3}  ({earliest} to {latest})"
            )
    else:
        print("   No forecast data found")

    cur.close()
    conn.close()

    print("\nUpload complete!")
    return True


if __name__ == "__main__":
    success = upload_forecasts_to_db()
    if not success:
        exit(1)
