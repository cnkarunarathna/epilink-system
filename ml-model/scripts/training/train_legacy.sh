#!/bin/bash

# ============================================================
# EpiLink Legacy ML Training (UV)
# ============================================================
# Trains the original single-model XGBoost approach.
# Preserved for academic comparison with enhanced approach.
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
echo -e "${BLUE}  EpiLink Legacy ML Training (V1)${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Run training with UV
uv run python -m src.legacy.train_model

echo ""
echo -e "${GREEN}Legacy model training complete!${NC}"
echo "   Model saved to: models/legacy/"
echo ""
