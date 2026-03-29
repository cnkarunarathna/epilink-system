#!/bin/bash

# ============================================================
# Database Setup Only
# ============================================================
# Quick database setup without training.
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}EpiLink Database Setup${NC}"
echo ""

# Activate environment
if command -v uv &> /dev/null; then
    echo "Using UV..."
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "1. Creating database schema..."
python setup_database.py || exit 1

echo "2. Migrating historical data..."
python migrate_data_to_db.py || exit 1

echo ""
echo -e "${GREEN}Database setup complete!${NC}"
