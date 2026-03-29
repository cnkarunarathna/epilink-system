#!/usr/bin/env bash

# EpiLink ML API Server (Production)
# Usage:
#   ./run_prod.sh            -> runs on 0.0.0.0:8000
#   ./run_prod.sh --port 8080

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HOST="0.0.0.0"
PORT=8000

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --host) HOST="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--host <host>] [--port <port>]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Use UV if available
if command -v uv &> /dev/null; then
  exec uv run uvicorn app:app --host "$HOST" --port "$PORT" --workers 4
else
  # Activate venv
  if [ -d "$ROOT_DIR/.venv" ]; then
    source "$ROOT_DIR/.venv/bin/activate"
  fi
  exec uvicorn app:app --host "$HOST" --port "$PORT" --workers 4
fi

