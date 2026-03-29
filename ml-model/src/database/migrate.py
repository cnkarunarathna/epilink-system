"""
Migrate data from CSV files to PostgreSQL database.
Run this script once to populate the database with existing data.
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import os
import sys
from tqdm import tqdm
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DB_CONFIG

# Data paths
DATA_DIR = PROJECT_ROOT / "data"
DENGUE_CSV = DATA_DIR / "srilanka_weekly_dengue.csv"
WEATHER_DIR = DATA_DIR / "weather_data"

def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(**DB_CONFIG)


def migrate_dengue_cases():
    """Migrate dengue cases from CSV to database."""
    print("Migrating dengue cases...")

    # Read dengue data
    df = pd.read_csv(DENGUE_CSV)

    conn = get_db_connection()
    cur = conn.cursor()

    # Get district IDs
    cur.execute("SELECT id, name FROM districts")
    district_map = {name: id for id, name in cur.fetchall()}

    # Prepare data for insertion
    records = []
    for _, row in df.iterrows():
        if row["district"] in district_map:
            records.append(
                (
                    district_map[row["district"]],
                    int(row["year"]),
                    int(row["week"]),
                    int(row["cases"]),
                )
            )

    # Bulk insert
    insert_query = """
        INSERT INTO dengue_cases (district_id, year, week, cases)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (district_id, year, week) DO UPDATE
        SET cases = EXCLUDED.cases
    """

    execute_batch(cur, insert_query, records, page_size=1000)
    conn.commit()

    print(f"Migrated {len(records)} dengue case records")

    cur.close()
    conn.close()


def migrate_weather_data():
    """Migrate weather data from CSV files to database."""
    print("Migrating weather data...")

    if not WEATHER_DIR.exists():
        print("No weather data directory found. Skipping weather migration.")
        return

    conn = get_db_connection()
    cur = conn.cursor()

    # Get district IDs
    cur.execute("SELECT id, name FROM districts")
    district_map = {name: id for id, name in cur.fetchall()}

    total_records = 0

    # Process each weather file
    weather_files = [f for f in os.listdir(WEATHER_DIR) if f.endswith("_weather.csv")]

    for filename in tqdm(weather_files, desc="Processing weather files"):
        # Extract district name from filename (e.g., "Colombo_weather.csv" -> "Colombo")
        district_name = filename.replace("_weather.csv", "")

        if district_name not in district_map:
            print(f"District {district_name} not found in database")
            continue

        district_id = district_map[district_name]

        # Read weather data
        df = pd.read_csv(WEATHER_DIR / filename)

        # Prepare records
        records = []
        for _, row in df.iterrows():
            records.append(
                (
                    district_id,
                    int(row["year"]),
                    int(row["week"]),
                    (
                        float(row["temperature_2m_mean"])
                        if pd.notna(row["temperature_2m_mean"])
                        else None
                    ),
                    (
                        float(row["precipitation_sum"])
                        if pd.notna(row["precipitation_sum"])
                        else None
                    ),
                )
            )

        # Bulk insert
        insert_query = """
            INSERT INTO weather_data (district_id, year, week, temperature_2m_mean, precipitation_sum)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (district_id, year, week) DO UPDATE
            SET temperature_2m_mean = EXCLUDED.temperature_2m_mean,
                precipitation_sum = EXCLUDED.precipitation_sum
        """

        execute_batch(cur, insert_query, records, page_size=1000)
        total_records += len(records)

    conn.commit()
    print(f"Migrated {total_records} weather data records")

    cur.close()
    conn.close()


def verify_migration():
    """Verify data migration."""
    print("\nVerifying migration...")

    conn = get_db_connection()
    cur = conn.cursor()

    # Check counts
    cur.execute("SELECT COUNT(*) FROM districts")
    district_count = cur.fetchone()[0]
    print(f"  Districts: {district_count}")

    cur.execute("SELECT COUNT(*) FROM dengue_cases")
    dengue_count = cur.fetchone()[0]
    print(f"  Dengue cases: {dengue_count}")

    cur.execute("SELECT COUNT(*) FROM weather_data")
    weather_count = cur.fetchone()[0]
    print(f"  Weather records: {weather_count}")

    # Sample query
    cur.execute(
        """
        SELECT d.name, dc.year, dc.week, dc.cases, 
               w.temperature_2m_mean, w.precipitation_sum
        FROM dengue_cases dc
        JOIN districts d ON dc.district_id = d.id
        LEFT JOIN weather_data w ON dc.district_id = w.district_id 
                                  AND dc.year = w.year 
                                  AND dc.week = w.week
        LIMIT 5
    """
    )

    print("\n  Sample records:")
    for row in cur.fetchall():
        print(f"    {row}")

    cur.close()
    conn.close()

    print("\nMigration verification complete!")


def main():
    """Main migration process."""
    print("Starting data migration to PostgreSQL...\n")

    try:
        migrate_dengue_cases()
        migrate_weather_data()
        verify_migration()

        print("\nAll data successfully migrated to PostgreSQL!")

    except psycopg2.Error as e:
        print(f"\nDatabase error: {e}")
        print("\nMake sure:")
        print("  1. PostgreSQL is running")
        print("  2. Database exists (create with: CREATE DATABASE epilink_db;)")
        print("  3. Schema is created (run: psql -d epilink_db -f database_schema.sql)")
        print("  4. .env file is configured correctly")

    except Exception as e:
        print(f"\nError: {e}")


if __name__ == "__main__":
    main()
