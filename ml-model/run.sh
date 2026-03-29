#!/usr/bin/env bash

# EpiLink ML API Server (Development)
# Usage:
#   ./run.sh              -> runs on 127.0.0.1:8000 with --reload
#   ./run.sh --host 0.0.0.0 --port 8000
#   ./run.sh --no-reload  -> runs without reload

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HOST="127.0.0.1"
PORT=8000
RELOAD="--reload"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --host) HOST="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --no-reload|--prod) RELOAD=""; shift ;;
    -h|--help)
      echo "Usage: $0 [--host <host>] [--port <port>] [--no-reload]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Use UV if available, otherwise venv
if command -v uv &> /dev/null; then
  exec uv run uvicorn app:app --host "$HOST" --port "$PORT" $RELOAD
else
  # Activate venv
  if [ -d "$ROOT_DIR/.venv" ]; then
    source "$ROOT_DIR/.venv/bin/activate"
  fi
  exec uvicorn app:app --host "$HOST" --port "$PORT" $RELOAD
fi

