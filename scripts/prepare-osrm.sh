#!/usr/bin/env bash
# One-time setup: download Sri Lanka OSM data and pre-process it for OSRM.
# Run this once from the repo root before starting docker-compose.
#
# Usage:
#   bash scripts/prepare-osrm.sh
#
# Output: ./osrm-data/sri-lanka-latest.osrm (and companion files)
# After this runs, `docker-compose up osrm` will start successfully.

set -euo pipefail

OSRM_DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/osrm-data"
PBF_FILE="$OSRM_DATA_DIR/sri-lanka-latest.osm.pbf"
OSRM_IMAGE="osrm/osrm-backend:latest"

echo "==> OSRM data directory: $OSRM_DATA_DIR"
mkdir -p "$OSRM_DATA_DIR"

# Step 1: Download Sri Lanka OSM extract (~70 MB)
if [ -f "$PBF_FILE" ]; then
  echo "==> sri-lanka-latest.osm.pbf already exists, skipping download."
else
  echo "==> Downloading Sri Lanka OSM extract from Geofabrik..."
  curl -L -o "$PBF_FILE" \
    "https://download.geofabrik.de/asia/sri-lanka-latest.osm.pbf"
  echo "==> Download complete."
fi

# Step 2: Extract (builds .osrm graph)
echo "==> Running osrm-extract..."
docker run --rm -t \
  -v "$OSRM_DATA_DIR:/data" \
  "$OSRM_IMAGE" \
  osrm-extract -p /opt/car.lua /data/sri-lanka-latest.osm.pbf

# Step 3: Partition (MLD algorithm — faster than CH for real-time updates)
echo "==> Running osrm-partition..."
docker run --rm -t \
  -v "$OSRM_DATA_DIR:/data" \
  "$OSRM_IMAGE" \
  osrm-partition /data/sri-lanka-latest.osrm

# Step 4: Customize
echo "==> Running osrm-customize..."
docker run --rm -t \
  -v "$OSRM_DATA_DIR:/data" \
  "$OSRM_IMAGE" \
  osrm-customize /data/sri-lanka-latest.osrm

echo ""
echo "==> OSRM data preparation complete."
echo "    You can now start the OSRM service:"
echo "    docker-compose up -d osrm"
