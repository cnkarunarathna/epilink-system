#!/bin/bash

# ============================================================
# EpiLink Complete Setup Script
# ============================================================
# Sets up the complete EpiLink ML environment including:
# 1. Python dependencies (UV or pip)
# 2. Database schema and data
# 3. Model training (legacy or enhanced)
# 4. Backfill predictions
# 5. Test weekly forecast
#
# Usage:
#   ./scripts/setup/setup_all.sh                    # Full setup with enhanced model
#   ./scripts/setup/setup_all.sh --legacy           # Full setup with legacy model
#   ./scripts/setup/setup_all.sh --skip-training    # Setup without training
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

# Arguments
USE_LEGACY=false
SKIP_TRAINING=false
TUNE_MODEL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --legacy)
            USE_LEGACY=true
            shift
            ;;
        --skip-training)
            SKIP_TRAINING=true
            shift
            ;;
        --tune)
            TUNE_MODEL=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

print_header() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  EpiLink Complete Setup${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    echo "Configuration:"
    echo "  • Model Type: $([ "$USE_LEGACY" = true ] && echo "Legacy (V1)" || echo "Enhanced (V2)")"
    echo "  • Training: $([ "$SKIP_TRAINING" = true ] && echo "Skipped" || echo "Enabled")"
    echo "  • Tuning: $([ "$TUNE_MODEL" = true ] && echo "Yes" || echo "No")"
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
    
    echo "   Migrating historical data..."
    uv run python -m src.database.migrate || exit 1
    
    echo -e "${GREEN}   Database ready${NC}"
}

step_3_training() {
    if [ "$SKIP_TRAINING" = true ]; then
        echo ""
        echo -e "${YELLOW}   Training skipped${NC}"
        return
    fi
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}3. Training Model${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$USE_LEGACY" = true ]; then
        echo "   Training legacy model (XGBoost only)..."
        uv run python -m src.legacy.train_model || exit 1
    else
        echo "   Training enhanced model (Ensemble)..."
        if [ "$TUNE_MODEL" = true ]; then
            uv run python -m src.enhanced.train --tune || exit 1
        else
            uv run python -m src.enhanced.train || exit 1
        fi
    fi
    
    echo -e "${GREEN}   Model trained${NC}"
}

step_4_backfill() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}4. Backfilling Predictions${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
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
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "Database is ready for production."
    echo "Weekly forecasts will run automatically via GitHub Actions."
    echo ""
    echo "Next steps:"
    echo "  • Start API: ./run.sh"
    echo "  • View docs: http://localhost:8000/docs"
    echo ""
}

# Run all steps
print_header
step_1_dependencies
step_2_database
step_3_training
step_4_backfill
step_5_test_forecast
print_complete
