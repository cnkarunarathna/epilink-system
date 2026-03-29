#!/bin/bash

# ============================================================
# EpiLink Enhanced Model Setup Script
# ============================================================
# Complete setup for the enhanced ensemble model pipeline:
# 1. Python dependencies (UV)
# 2. Database schema (with humidity support)
# 3. Historical data migration
# 4. Enhanced model training (XGBoost + LightGBM ensemble)
# 5. Backfill predictions using enhanced model
# 6. Test weekly forecast
#
# Weather data includes: temperature, precipitation, humidity
# All fetched from Open-Meteo API
#
# Usage:
#   ./scripts/setup/setup_enhanced.sh           # Full setup
#   ./scripts/setup/setup_enhanced.sh --tune    # With hyperparameter tuning
#   ./scripts/setup/setup_enhanced.sh --tune 100  # 100 tuning trials
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

# Arguments
TUNE_MODEL=false
N_TRIALS=50

while [[ $# -gt 0 ]]; do
    case $1 in
        --tune)
            TUNE_MODEL=true
            shift
            if [[ $1 =~ ^[0-9]+$ ]]; then
                N_TRIALS=$1
                shift
            fi
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: ./scripts/setup/setup_enhanced.sh [--tune [n_trials]]"
            exit 1
            ;;
    esac
done

print_header() {
    echo ""
    echo -e "${MAGENTA}============================================================${NC}"
    echo -e "${MAGENTA}  EpiLink Enhanced Model Setup${NC}"
    echo -e "${MAGENTA}============================================================${NC}"
    echo ""
    echo "This script sets up the complete enhanced ML pipeline:"
    echo "  • XGBoost + LightGBM ensemble model"
    echo "  • Uncertainty estimation with prediction intervals"
    echo "  • Advanced feature engineering (60+ features)"
    echo "  • Weather data: temperature, precipitation, humidity"
    echo ""
    echo "Configuration:"
    echo "  • Hyperparameter Tuning: $([ "$TUNE_MODEL" = true ] && echo "Yes ($N_TRIALS trials)" || echo "No (default params)")"
    echo ""
}

step_1_dependencies() {
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}1. Installing Dependencies${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if command -v uv &> /dev/null; then
        echo "   Using UV package manager..."
        uv sync
    else
        echo "   UV not found. Installing UV..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.cargo/bin:$PATH"
        uv sync
    fi
    echo -e "${GREEN}   Dependencies installed${NC}"
}

step_2_database() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}2. Setting Up Database${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check for .env
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            echo -e "${YELLOW}   .env not found, copying from .env.example${NC}"
            cp .env.example .env
            echo -e "${YELLOW}   Please edit .env with your database credentials and re-run.${NC}"
            exit 1
        else
            echo -e "${RED}   .env file not found!${NC}"
            exit 1
        fi
    fi
    
    echo "   Creating schema..."
    uv run python -m src.database.setup || exit 1
    
    echo "   Migrating dengue case data..."
    uv run python -m src.database.migrate || exit 1
    
    echo ""
    echo "   Fetching historical weather data (with humidity) from Open-Meteo..."
    echo "   This may take a few minutes..."
    uv run python -m src.database.fetch_weather || exit 1
    
    echo -e "${GREEN}   Database ready with complete weather data${NC}"
}

step_3_train_enhanced() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}3. Training Enhanced Ensemble Model${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$TUNE_MODEL" = true ]; then
        echo "   Mode: Training with Optuna hyperparameter tuning"
        echo "   Trials: $N_TRIALS"
        echo ""
        uv run python -m src.enhanced.train --tune --n_trials $N_TRIALS || exit 1
    else
        echo "   Mode: Training with default parameters"
        echo ""
        uv run python -m src.enhanced.train || exit 1
    fi
    
    # Verify model was created
    if [ -f "models/enhanced/dengue_ensemble_model.pkl" ]; then
        echo -e "${GREEN}   Enhanced model trained and saved${NC}"
        echo "   Models saved to: models/enhanced/"
    else
        echo -e "${RED}   Model training failed!${NC}"
        exit 1
    fi
}

step_4_backfill() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}4. Backfilling Predictions${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Use the enhanced model for backfilling
    uv run python -m src.forecasting.backfill || exit 1
    echo -e "${GREEN}   Predictions backfilled${NC}"
}

step_5_test_forecast() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}5. Testing Weekly Forecast${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    uv run python -m src.forecasting.weekly || exit 1
    echo -e "${GREEN}   Forecast generated successfully${NC}"
}

print_complete() {
    echo ""
    echo -e "${MAGENTA}============================================================${NC}"
    echo -e "${MAGENTA}  Enhanced Model Setup Complete!${NC}"
    echo -e "${MAGENTA}============================================================${NC}"
    echo ""
    echo "Enhanced Ensemble Model Features:"
    echo "   • XGBoost + LightGBM weighted ensemble"
    echo "   • Uncertainty estimation with 80% confidence intervals"
    echo "   • Advanced feature engineering (lag, cyclical, trend)"
    echo ""
    echo "Model Files:"
    echo "   • models/enhanced/dengue_ensemble_model.pkl"
    echo "   • models/enhanced/uncertainty_estimator.pkl"
    echo "   • models/enhanced/feature_engineer.pkl"
    echo "   • models/enhanced/model_metadata.pkl"
    echo ""
    echo "Next steps:"
    echo "   • Start API: ./run.sh"
    echo "   • View docs: http://localhost:8000/docs"
    echo "   • Run tests: uv run pytest"
    echo ""
}

# Run all steps
print_header
step_1_dependencies
step_2_database
step_3_train_enhanced
step_4_backfill
step_5_test_forecast
print_complete
