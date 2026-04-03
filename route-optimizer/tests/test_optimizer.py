"""Unit tests for the OR-Tools TSP solver."""

import pytest

from optimizer import solve_tsp


def test_single_node_returns_zero():
    assert solve_tsp([[0]]) == [0]


def test_two_nodes_returns_both():
    matrix = [[0, 100], [100, 0]]
    result = solve_tsp(matrix)
    assert result == [0, 1]


def test_triangle_optimal_order():
    """
    3 nodes. Distances:
        0→1: 1,  0→2: 10
        1→2: 1
    Optimal route starting from 0: 0 → 1 → 2 (total cost 2)
    Suboptimal: 0 → 2 → 1 (total cost 11)
    """
    matrix = [
        [0, 1, 10],
        [1, 0, 1],
        [10, 1, 0],
    ]
    result = solve_tsp(matrix)
    assert result[0] == 0, "Route must start at depot (index 0)"
    assert set(result) == {0, 1, 2}, "All nodes must be visited"
    assert result == [0, 1, 2], "Optimal order should be 0 → 1 → 2"


def test_four_nodes_known_optimal():
    """
    Symmetric 4-node matrix where optimal tour is 0→1→3→2 (cost 4).
    """
    matrix = [
        [0, 1, 10, 10],
        [1, 0, 10, 1],
        [10, 10, 0, 1],
        [10, 1, 1, 0],
    ]
    result = solve_tsp(matrix)
    assert result[0] == 0
    assert set(result) == {0, 1, 2, 3}
    # Compute tour cost
    cost = sum(matrix[result[i]][result[i + 1]] for i in range(len(result) - 1))
    assert cost <= 4, f"Expected optimal cost ≤ 4, got {cost} for order {result}"


def test_fallback_on_empty_diagonal_not_raised():
    """Solver should handle a valid all-zero diagonal matrix without error."""
    matrix = [
        [0, 5, 9],
        [5, 0, 3],
        [9, 3, 0],
    ]
    result = solve_tsp(matrix)
    assert len(result) == 3
    assert set(result) == {0, 1, 2}


def test_returns_list_of_ints():
    matrix = [[0, 2], [2, 0]]
    result = solve_tsp(matrix)
    assert isinstance(result, list)
    assert all(isinstance(i, int) for i in result)
