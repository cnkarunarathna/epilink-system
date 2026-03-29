"""
Migration: Add weekly_forecasts table.

Adds the weekly_forecasts table that stores ML predictions with uncertainty
bounds and SHAP-based feature importances for Enhancement 6 of the
Explainable Analytics service.

Run once on an existing database:
    uv run python -m src.database.add_weekly_forecasts
"""

import sys
import psycopg2
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import DB_CONFIG

DDL = """
CREATE TABLE IF NOT EXISTS weekly_forecasts (
    id SERIAL PRIMARY KEY,
    district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    week INTEGER NOT NULL,
    predicted_cases INTEGER NOT NULL,
    model_risk_score DECIMAL(6, 4),
    uncertainty_lower DECIMAL(6, 4),
    uncertainty_upper DECIMAL(6, 4),
    feature_importances JSONB,
    model_type VARCHAR(20) DEFAULT 'enhanced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(district_id, year, week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_forecasts_district_year_week
    ON weekly_forecasts(district_id, year, week);
"""


def run():
    print("Migration: add weekly_forecasts table")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(DDL)
    conn.commit()
    # Verify
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'weekly_forecasts'"
    )
    exists = cur.fetchone()[0] == 1
    cur.close()
    conn.close()
    if exists:
        print("   weekly_forecasts table is ready.")
    else:
        print("   ERROR: table was not created.")
        sys.exit(1)


if __name__ == "__main__":
    run()
