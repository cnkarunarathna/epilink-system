#!/bin/bash

# ============================================================
# Generate Weekly Forecast (Enhanced Model)
# ============================================================
# Runs the weekly forecast using the enhanced ensemble model.
# Designed for GitHub Actions cron job.
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}Generating Weekly Forecast (Enhanced Model)${NC}"
echo ""

# Check model exists
if [ ! -f "models/dengue_ensemble_model.pkl" ] && [ ! -f "models/enhanced/dengue_ensemble_model.pkl" ]; then
    echo "Enhanced model not found! Falling back to legacy..."
    
    if [ ! -f "models/dengue_xgb_model.pkl" ]; then
        echo "No model found! Please train first."
        exit 1
    fi
fi

# Activate environment
if command -v uv &> /dev/null; then
    uv run python generate_weekly_forecast.py
elif [ -d ".venv" ]; then
    source .venv/bin/activate
    python generate_weekly_forecast.py
else
    python generate_weekly_forecast.py
fi

echo ""
echo -e "${GREEN}Forecast generated and uploaded to database${NC}"
