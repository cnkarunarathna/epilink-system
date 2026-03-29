"""
Database Health Check Script for EpiLink ML Model.

This script verifies that all ML-related database tables exist and have the correct structure.
Run this to detect if the main NestJS system has accidentally corrupted or modified table schemas.

Usage:
    uv run python -m src.database.health_check
    uv run db-health
"""

import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

import psycopg2

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DB_CONFIG


# Expected table schemas for ML model data
EXPECTED_TABLES = {
    "districts": {
        "columns": {
            "id": {"type": "integer", "nullable": False},
            "name": {"type": "character varying", "nullable": False},
            "latitude": {"type": "numeric", "nullable": False},
            "longitude": {"type": "numeric", "nullable": False},
            "created_at": {"type": "timestamp", "nullable": True},
        },
        "expected_rows": 25,  # 25 Sri Lankan districts
    },
    "dengue_cases": {
        "columns": {
            "id": {"type": "integer", "nullable": False},
            "district_id": {"type": "integer", "nullable": True},
            "year": {"type": "integer", "nullable": False},
            "week": {"type": "integer", "nullable": False},
            "cases": {"type": "integer", "nullable": False},
            "created_at": {"type": "timestamp", "nullable": True},
        },
        "min_rows": 100,  # Should have historical data
    },
    "weather_data": {
        "columns": {
            "id": {"type": "integer", "nullable": False},
            "district_id": {"type": "integer", "nullable": True},
            "year": {"type": "integer", "nullable": False},
            "week": {"type": "integer", "nullable": False},
            "temperature_2m_mean": {"type": "numeric", "nullable": True},
            "precipitation_sum": {"type": "numeric", "nullable": True},
            "relative_humidity_mean": {"type": "numeric", "nullable": True},
            "created_at": {"type": "timestamp", "nullable": True},
        },
        "min_rows": 100,  # Should have historical data
    },
    "district_metadata": {
        "columns": {
            "id": {"type": "integer", "nullable": False},
            "district_id": {"type": "integer", "nullable": True},
            "population": {"type": "integer", "nullable": True},
            "area_sq_km": {"type": "numeric", "nullable": True},
            "population_density": {"type": "numeric", "nullable": True},
            "urbanization_level": {"type": "character varying", "nullable": True},
            "created_at": {"type": "timestamp", "nullable": True},
        },
        "expected_rows": 25,
    },
}


class HealthCheckResult:
    """Result of a health check."""
    
    def __init__(self):
        self.passed: List[str] = []
        self.warnings: List[str] = []
        self.errors: List[str] = []
    
    @property
    def is_healthy(self) -> bool:
        return len(self.errors) == 0
    
    def add_pass(self, msg: str):
        self.passed.append(msg)
    
    def add_warning(self, msg: str):
        self.warnings.append(msg)
    
    def add_error(self, msg: str):
        self.errors.append(msg)


def get_table_columns(cur, table_name: str) -> Dict[str, Dict]:
    """Get column information for a table."""
    cur.execute("""
        SELECT 
            column_name,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    
    columns = {}
    for row in cur.fetchall():
        columns[row[0]] = {
            "type": row[1],
            "nullable": row[2] == "YES"
        }
    return columns


def get_row_count(cur, table_name: str) -> int:
    """Get row count for a table."""
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    return cur.fetchone()[0]


def check_table_exists(cur, table_name: str) -> bool:
    """Check if a table exists."""
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = %s
        )
    """, (table_name,))
    return cur.fetchone()[0]


def check_foreign_keys(cur) -> List[Tuple[str, str, str, str]]:
    """Get all foreign key relationships."""
    cur.execute("""
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
        AND tc.table_schema = 'public'
    """)
    return cur.fetchall()


def run_health_check() -> HealthCheckResult:
    """Run comprehensive database health check."""
    result = HealthCheckResult()
    
    print("=" * 70)
    print("DATABASE HEALTH CHECK")
    print("=" * 70)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Connect to database
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        result.add_pass("Database connection successful")
        print("Database connection: OK")
    except Exception as e:
        result.add_error(f"Cannot connect to database: {e}")
        print(f"Database connection: FAILED - {e}")
        return result
    
    print()
    print("-" * 70)
    print("TABLE STRUCTURE CHECK")
    print("-" * 70)
    
    # Check each expected table
    for table_name, expected in EXPECTED_TABLES.items():
        print(f"\nChecking table: {table_name}")
        
        # Check table exists
        if not check_table_exists(cur, table_name):
            result.add_error(f"Table '{table_name}' does not exist")
            print(f"   Table does not exist!")
            continue
        
        result.add_pass(f"Table '{table_name}' exists")
        print(f"   Table exists")
        
        # Check columns
        actual_columns = get_table_columns(cur, table_name)
        expected_columns = expected["columns"]
        
        # Check for missing columns
        for col_name, col_spec in expected_columns.items():
            if col_name not in actual_columns:
                result.add_error(f"Table '{table_name}': Missing column '{col_name}'")
                print(f"   Missing column: {col_name}")
            else:
                actual = actual_columns[col_name]
                # Check type (flexible matching)
                if col_spec["type"] not in actual["type"]:
                    result.add_warning(
                        f"Table '{table_name}': Column '{col_name}' type mismatch - "
                        f"expected '{col_spec['type']}', got '{actual['type']}'"
                    )
                    print(f"   Column '{col_name}' type: {actual['type']} (expected: {col_spec['type']})")
                else:
                    print(f"   Column '{col_name}': {actual['type']}")
        
        # Check for extra columns (warning only)
        for col_name in actual_columns:
            if col_name not in expected_columns:
                result.add_warning(f"Table '{table_name}': Extra column '{col_name}' found")
                print(f"   Extra column: {col_name}")
        
        # Check row count
        row_count = get_row_count(cur, table_name)
        if "expected_rows" in expected:
            if row_count != expected["expected_rows"]:
                result.add_warning(
                    f"Table '{table_name}': Expected {expected['expected_rows']} rows, found {row_count}"
                )
                print(f"   Row count: {row_count} (expected: {expected['expected_rows']})")
            else:
                print(f"   Row count: {row_count}")
        elif "min_rows" in expected:
            if row_count < expected["min_rows"]:
                result.add_warning(
                    f"Table '{table_name}': Expected at least {expected['min_rows']} rows, found {row_count}"
                )
                print(f"   Row count: {row_count} (expected min: {expected['min_rows']})")
            else:
                print(f"   Row count: {row_count}")
        else:
            print(f"   Row count: {row_count}")
    
    print()
    print("-" * 70)
    print("FOREIGN KEY CHECK")
    print("-" * 70)
    
    # Check foreign keys
    fk_relationships = check_foreign_keys(cur)
    expected_fks = [
        ("dengue_cases", "district_id", "districts", "id"),
        ("weather_data", "district_id", "districts", "id"),
        ("district_metadata", "district_id", "districts", "id"),
    ]
    
    for expected_fk in expected_fks:
        if expected_fk in fk_relationships:
            result.add_pass(f"FK: {expected_fk[0]}.{expected_fk[1]} -> {expected_fk[2]}.{expected_fk[3]}")
            print(f"{expected_fk[0]}.{expected_fk[1]} -> {expected_fk[2]}.{expected_fk[3]}")
        else:
            result.add_warning(f"Missing FK: {expected_fk[0]}.{expected_fk[1]} -> {expected_fk[2]}.{expected_fk[3]}")
            print(f"Missing: {expected_fk[0]}.{expected_fk[1]} -> {expected_fk[2]}.{expected_fk[3]}")
    
    print()
    print("-" * 70)
    print("DATA INTEGRITY CHECK")
    print("-" * 70)
    
    # Check for orphaned records
    for table in ["dengue_cases", "weather_data", "district_metadata"]:
        if check_table_exists(cur, table):
            cur.execute(f"""
                SELECT COUNT(*) FROM {table} t
                LEFT JOIN districts d ON t.district_id = d.id
                WHERE d.id IS NULL AND t.district_id IS NOT NULL
            """)
            orphaned = cur.fetchone()[0]
            if orphaned > 0:
                result.add_warning(f"Table '{table}': {orphaned} orphaned records (invalid district_id)")
                print(f"{table}: {orphaned} orphaned records")
            else:
                print(f"{table}: No orphaned records")
    
    # Check for data consistency
    if check_table_exists(cur, "dengue_cases"):
        cur.execute("SELECT MIN(year), MAX(year) FROM dengue_cases")
        min_year, max_year = cur.fetchone()
        if min_year and max_year:
            print(f"Dengue data range: {min_year} - {max_year}")
    
    if check_table_exists(cur, "weather_data"):
        cur.execute("SELECT COUNT(*) FROM weather_data WHERE relative_humidity_mean IS NOT NULL")
        humidity_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM weather_data")
        total_weather = cur.fetchone()[0]
        humidity_pct = (humidity_count / total_weather * 100) if total_weather > 0 else 0
        if humidity_pct < 50:
            result.add_warning(f"Only {humidity_pct:.1f}% of weather records have humidity data")
            print(f"Humidity data: {humidity_pct:.1f}% coverage")
        else:
            print(f"Humidity data: {humidity_pct:.1f}% coverage")
    
    cur.close()
    conn.close()
    
    # Print summary
    print()
    print("=" * 70)
    print("HEALTH CHECK SUMMARY")
    print("=" * 70)
    print(f"Passed:   {len(result.passed)}")
    print(f"Warnings: {len(result.warnings)}")
    print(f"Errors:   {len(result.errors)}")
    print()
    
    if result.is_healthy:
        print("DATABASE IS HEALTHY!")
    else:
        print("DATABASE HAS ISSUES!")
        print("\nErrors found:")
        for error in result.errors:
            print(f"  • {error}")
    
    if result.warnings:
        print("\nWarnings:")
        for warning in result.warnings:
            print(f"  • {warning}")
    
    print("=" * 70)
    
    return result


def main():
    """Entry point for CLI."""
    result = run_health_check()
    sys.exit(0 if result.is_healthy else 1)


if __name__ == "__main__":
    main()
