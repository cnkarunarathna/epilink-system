# EpiLink Route Optimizer

Python microservice that solves the Traveling Salesman Problem (TSP) for PHI daily task routing using Google OR-Tools.

## Responsibilities

- Accept an N×N duration matrix (real road travel times from OSRM `/table`)
- Return the optimal visit order using OR-Tools with `GUIDED_LOCAL_SEARCH`
- Hard 2-second solver time cap — always responds promptly for N ≤ 15 waypoints

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/optimize` | Solve TSP, return ordered indices |
| `GET` | `/health` | Health check |

### POST /optimize

```json
// Request
{
  "duration_matrix": [[0, 420, 840], [420, 0, 360], [840, 360, 0]]
}

// Response
{
  "ordered_indices": [0, 1, 2]
}
```

## Development

```bash
uv sync --dev
uv run pytest
uv run uvicorn app:app --reload --port 8001
```

## Docker

```bash
docker build -t epilink-route-optimizer .
docker run -p 8001:8001 epilink-route-optimizer
```
