"""Integration tests for the FastAPI application."""

import pytest
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_optimize_single_node():
    response = client.post("/optimize", json={"duration_matrix": [[0]]})
    assert response.status_code == 200
    assert response.json()["ordered_indices"] == [0]


def test_optimize_two_nodes():
    response = client.post(
        "/optimize",
        json={"duration_matrix": [[0, 300], [300, 0]]},
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data["ordered_indices"]) == {0, 1}


def test_optimize_three_nodes_returns_all():
    matrix = [[0, 100, 500], [100, 0, 100], [500, 100, 0]]
    response = client.post("/optimize", json={"duration_matrix": matrix})
    assert response.status_code == 200
    result = response.json()["ordered_indices"]
    assert len(result) == 3
    assert set(result) == {0, 1, 2}


def test_optimize_empty_matrix_returns_422():
    response = client.post("/optimize", json={"duration_matrix": []})
    assert response.status_code == 422


def test_optimize_non_square_matrix_returns_422():
    response = client.post(
        "/optimize",
        json={"duration_matrix": [[0, 100, 200], [100, 0]]},
    )
    assert response.status_code == 422


def test_optimize_negative_value_returns_422():
    response = client.post(
        "/optimize",
        json={"duration_matrix": [[0, -1], [-1, 0]]},
    )
    assert response.status_code == 422


def test_optimize_response_schema():
    matrix = [[0, 200, 600], [200, 0, 300], [600, 300, 0]]
    response = client.post("/optimize", json={"duration_matrix": matrix})
    assert response.status_code == 200
    data = response.json()
    assert "ordered_indices" in data
    assert isinstance(data["ordered_indices"], list)
