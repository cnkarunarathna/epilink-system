"""
Complete database setup script.
This script will:
1. Create the database if it doesn't exist
2. Create the schema (tables)
3. Verify the setup
"""

import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys
import os
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DB_CONFIG

# Schema file path
SCHEMA_FILE = Path(__file__).parent / "schema.sql"

def create_database():
    """Create the database if it doesn't exist."""
    print("Checking database connection...")

    db_name = DB_CONFIG.get("database")

    # First, try connecting directly to the target database
    # This works for managed databases (Heroku, AWS RDS) where the DB already exists
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.close()
        print(f"  Database '{db_name}' is accessible")
        return True
    except psycopg2.OperationalError:
        # Database doesn't exist or connection failed, try to create it
        pass

    # Try to connect to 'postgres' database to create our database
    # This works for local PostgreSQL installations
    conn_params = DB_CONFIG.copy()
    conn_params.pop("database", None)

    try:
        conn = psycopg2.connect(**conn_params, database="postgres")
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # Check if database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))

        if cur.fetchone():
            print(f"  Database '{db_name}' already exists")
        else:
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
            print(f"  Database '{db_name}' created successfully")

        cur.close()
        conn.close()
        return True

    except psycopg2.Error as e:
        # For managed databases, we can't connect to 'postgres' - that's OK
        # if direct connection worked earlier
        print(f"  Cannot create database (managed DB service detected)")
        print(f"  Trying to connect directly to '{db_name}'...")
        
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            conn.close()
            print(f"  Database '{db_name}' is accessible")
            return True
        except psycopg2.Error as e2:
            print(f"  Error connecting to database: {e2}")
            return False


def create_schema():
    """Create database tables."""
    print("\nCreating database schema...")

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Read and execute schema file
        with open(SCHEMA_FILE, "r") as f:
            schema_sql = f.read()

        cur.execute(schema_sql)
        conn.commit()

        print("  Schema created successfully")

        cur.close()
        conn.close()
        return True

    except psycopg2.Error as e:
        print(f"  Database error: {e}")
        return False
    except FileNotFoundError:
        print(f"  Schema file not found: {SCHEMA_FILE}")
        return False


def verify_setup():
    """Verify database and tables are set up correctly."""
    print("\nVerifying setup...")

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Check tables exist
        cur.execute(
            """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """
        )

        tables = [row[0] for row in cur.fetchall()]

        expected_tables = ["districts", "dengue_cases", "weather_data"]

        print(f"  Found tables: {', '.join(tables)}")

        for table in expected_tables:
            if table in tables:
                print(f"  Table '{table}' exists")
            else:
                print(f"  Table '{table}' missing")
                return False

        # Check districts are populated
        cur.execute("SELECT COUNT(*) FROM districts")
        district_count = cur.fetchone()[0]
        print(f"  {district_count} districts loaded")

        cur.close()
        conn.close()
        return True

    except psycopg2.Error as e:
        print(f"  Database error: {e}")
        return False


def main():
    """Main setup process."""
    print("EpiLink Database Setup\n")

    # Check if .env file exists
    env_file = PROJECT_ROOT / ".env"
    try:
        with open(env_file, "r") as f:
            pass
    except FileNotFoundError:
        print("Warning: .env file not found!")
        print("  Using default database configuration")
        print("  Copy .env.example to .env and configure if needed\n")

    print(f"Database configuration:")
    print(f"  Host: {DB_CONFIG['host']}")
    print(f"  Port: {DB_CONFIG['port']}")
    print(f"  Database: {DB_CONFIG['database']}")
    print(f"  User: {DB_CONFIG['user']}\n")

    # Step 1: Create database
    if not create_database():
        print("\nFailed to create database. Please check:")
        print("  1. PostgreSQL is installed and running")
        print("  2. You have permission to create databases")
        print("  3. Database credentials in .env are correct")
        sys.exit(1)

    # Step 2: Create schema
    if not create_schema():
        print("\nFailed to create schema")
        sys.exit(1)

    # Step 3: Verify setup
    if not verify_setup():
        print("\nSetup verification failed")
        sys.exit(1)

    print("\nDatabase setup complete!")
    print("\nNext steps:")
    print("  1. Run: uv run python -m src.database.migrate")
    print("  2. Run: uv run python -m src.enhanced.train")


if __name__ == "__main__":
    main()
