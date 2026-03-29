"""
Check live database schema and verify alignment with script.
"""

import psycopg2
from config import DB_CONFIG


def check_database_schema():
    """Verify database schema matches expectations."""

    print("=" * 60)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 60)

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("\nConnected to database")

        # Check districts table
        print("\nDISTRICTS TABLE:")
        cur.execute(
            """
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'districts'
            ORDER BY ordinal_position
        """
        )
        print("   Columns:")
        for row in cur.fetchall():
            print(f"   - {row[0]}: {row[1]}{f'({row[2]})' if row[2] else ''}")

        cur.execute("SELECT COUNT(*) FROM districts")
        count = cur.fetchone()[0]
        print(f"   Total districts: {count}")

        cur.execute("SELECT name FROM districts ORDER BY name")
        districts = [row[0] for row in cur.fetchall()]
        print(f"   District names: {', '.join(districts[:5])}... (showing first 5)")

        # Check dengue_cases table
        print("\nDENGUE_CASES TABLE:")
        cur.execute(
            """
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'dengue_cases'
            ORDER BY ordinal_position
        """
        )
        print("   Columns:")
        for row in cur.fetchall():
            print(f"   - {row[0]}: {row[1]}{f'({row[2]})' if row[2] else ''}")

        cur.execute("SELECT COUNT(*) FROM dengue_cases")
        count = cur.fetchone()[0]
        print(f"   Total records: {count}")

        cur.execute("SELECT COUNT(DISTINCT district_id) FROM dengue_cases")
        districts_with_data = cur.fetchone()[0]
        print(f"   Districts with data: {districts_with_data}")

        cur.execute(
            """
            SELECT MAX(year), MAX(week) 
            FROM dengue_cases 
            WHERE year = (SELECT MAX(year) FROM dengue_cases)
        """
        )
        latest = cur.fetchone()
        print(f"   Latest data: Week {latest[1]}/{latest[0]}")

        # Check weather_data table
        print("\nWEATHER_DATA TABLE:")
        cur.execute(
            """
            SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_name = 'weather_data'
            ORDER BY ordinal_position
        """
        )
        print("   Columns:")
        for row in cur.fetchall():
            precision_info = f"({row[3]},{row[4]})" if row[3] else ""
            print(f"   - {row[0]}: {row[1]}{precision_info}")

        cur.execute("SELECT COUNT(*) FROM weather_data")
        count = cur.fetchone()[0]
        print(f"   Total records: {count}")

        # Check unique constraints
        print("\nUNIQUE CONSTRAINTS:")
        cur.execute(
            """
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'UNIQUE'
                AND tc.table_name IN ('dengue_cases', 'weather_data')
            ORDER BY tc.table_name, kcu.ordinal_position
        """
        )
        current_table = None
        for row in cur.fetchall():
            if row[0] != current_table:
                print(f"   {row[0]}:")
                current_table = row[0]
            print(f"     - {row[1]}")

        # Check foreign keys
        print("\nFOREIGN KEYS:")
        cur.execute(
            """
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name IN ('dengue_cases', 'weather_data')
        """
        )
        for row in cur.fetchall():
            print(f"   {row[0]}.{row[1]} → {row[2]}.{row[3]}")

        # Check indexes
        print("\nINDEXES:")
        cur.execute(
            """
            SELECT tablename, indexname
            FROM pg_indexes
            WHERE tablename IN ('districts', 'dengue_cases', 'weather_data')
            ORDER BY tablename, indexname
        """
        )
        current_table = None
        for row in cur.fetchall():
            if row[0] != current_table:
                print(f"   {row[0]}:")
                current_table = row[0]
            print(f"     - {row[1]}")

        # Verify script compatibility
        print("\nCOMPATIBILITY CHECK:")

        # Check if all required columns exist
        required_checks = [
            ("districts", ["id", "name"]),
            ("dengue_cases", ["district_id", "year", "week", "cases"]),
            (
                "weather_data",
                [
                    "district_id",
                    "year",
                    "week",
                    "temperature_2m_mean",
                    "precipitation_sum",
                ],
            ),
        ]

        all_good = True
        for table, columns in required_checks:
            cur.execute(
                """
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = ANY(%s)
            """,
                (table, columns),
            )
            found = [row[0] for row in cur.fetchall()]
            missing = set(columns) - set(found)
            if missing:
                print(f"   {table}: Missing columns {missing}")
                all_good = False
            else:
                print(f"   {table}: All required columns present")

        if all_good:
            print("\nDATABASE SCHEMA IS FULLY COMPATIBLE!")
        else:
            print("\nDATABASE SCHEMA HAS ISSUES!")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\nError: {e}")
        return False

    print("\n" + "=" * 60)
    return True


if __name__ == "__main__":
    check_database_schema()
