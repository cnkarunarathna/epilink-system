"""
CLI entry points for running setup scripts.
These provide convenient uv run commands for setup tasks.
"""

import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent.parent


def run_script(script_path: str, args: list = None) -> int:
    """Run a bash script and return exit code."""
    project_root = get_project_root()
    full_path = project_root / script_path
    
    if not full_path.exists():
        print(f"Script not found: {full_path}")
        return 1
    
    cmd = ["bash", str(full_path)]
    if args:
        cmd.extend(args)
    
    result = subprocess.run(cmd, cwd=str(project_root))
    return result.returncode


def setup_enhanced():
    """Run the enhanced model setup script."""
    sys.exit(run_script("scripts/setup/setup_enhanced.sh", sys.argv[1:]))


def setup_all():
    """Run the complete setup script (alias for setup_enhanced)."""
    sys.exit(run_script("scripts/setup/setup_enhanced.sh", sys.argv[1:]))


def fetch_weather():
    """Fetch historical weather data from Open-Meteo."""
    from src.database.fetch_weather import fetch_and_store_historical_weather
    success = fetch_and_store_historical_weather()
    sys.exit(0 if success else 1)


def forecast():
    """Run the weekly forecast generation with enhanced model."""
    from src.forecasting.weekly import generate_weekly_forecast
    success = generate_weekly_forecast()
    sys.exit(0 if success else 1)


def backfill():
    """Run the backfill predictions script."""
    from src.forecasting.backfill import backfill_predictions
    success = backfill_predictions()
    sys.exit(0 if success else 1)
