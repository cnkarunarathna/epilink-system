#!/bin/bash

# ============================================================
# EpiLink Enhanced ML Training (UV)
# ============================================================
# Trains the enhanced ensemble model with XGBoost + LightGBM.
#
# Usage:
#   ./scripts/training/train_enhanced.sh              # Basic training
#   ./scripts/training/train_enhanced.sh --tune       # With Optuna tuning
#   ./scripts/training/train_enhanced.sh --tune 100   # 100 tuning trials
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  EpiLink Enhanced ML Training (V2)${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Parse arguments
ARGS=""
if [[ "$1" == "--tune" ]]; then
    ARGS="--tune"
    if [[ "$2" =~ ^[0-9]+$ ]]; then
        ARGS="--tune --n_trials $2"
    fi
    echo "  Mode: Training with hyperparameter tuning"
else
    echo "  Mode: Training with default parameters"
fi
echo ""

# Run training with UV
uv run python -m src.enhanced.train $ARGS

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Enhanced Model Training Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Models saved to: models/enhanced/"
echo ""
echo "Next steps:"
echo "  1. Start API:  ./run.sh"
echo "  2. Run tests:  uv run pytest"
echo ""
