"""
EpiLink Route Optimizer — FastAPI application.

Exposes a single POST /optimize endpoint that accepts a duration matrix
and returns the optimal visit order using Google OR-Tools TSP solver.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator

from optimizer import solve_tsp

app = FastAPI(
    title="EpiLink Route Optimizer",
    description="TSP-based route optimization for PHI daily task scheduling",
    version="1.0.0",
)


class OptimizeRequest(BaseModel):
    duration_matrix: list[list[int]]

    @field_validator("duration_matrix")
    @classmethod
    def validate_matrix(cls, matrix: list[list[int]]) -> list[list[int]]:
        n = len(matrix)
        if n == 0:
            raise ValueError("duration_matrix must not be empty")
        for i, row in enumerate(matrix):
            if len(row) != n:
                raise ValueError(
                    f"duration_matrix must be square: row {i} has {len(row)} elements, expected {n}"
                )
            for j, val in enumerate(row):
                if val < 0:
                    raise ValueError(
                        f"duration_matrix values must be non-negative: [{i}][{j}] = {val}"
                    )
        return matrix


class OptimizeResponse(BaseModel):
    ordered_indices: list[int]


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest) -> OptimizeResponse:
    """
    Return the optimal visit order for a set of waypoints.

    The caller (NestJS RouteService) is responsible for:
    - Building the N×N duration matrix from OSRM /table
    - Prepending the PHI origin as index 0 when provided
    - Stripping index 0 from the result when an origin was prepended

    Returns ordered_indices starting from depot (index 0).
    """
    ordered = solve_tsp(req.duration_matrix)
    return OptimizeResponse(ordered_indices=ordered)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
