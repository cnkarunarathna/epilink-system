"""
TSP solver using Google OR-Tools.

Accepts an N×N duration matrix (seconds, integers) and returns the optimal
visit order as a list of node indices starting from depot index 0.

The NestJS RouteService is responsible for:
  - Prepending the PHI origin as index 0 (when provided)
  - Stripping index 0 from the returned order (it is not a task)

When no origin is provided, index 0 is the first task and is included in output.
"""

from ortools.constraint_solver import pywrapcp, routing_enums_pb2


def solve_tsp(duration_matrix: list[list[int]]) -> list[int]:
    """
    Solve the Traveling Salesman Problem for a single vehicle starting at depot 0.

    Args:
        duration_matrix: N×N matrix of travel durations in seconds (non-negative integers).
                         Diagonal must be 0. Index 0 is treated as the depot.

    Returns:
        Ordered list of node indices representing the optimal visit sequence,
        beginning with 0 (depot). Falls back to [0, 1, ..., N-1] if no solution found.
    """
    n = len(duration_matrix)

    if n <= 1:
        return list(range(n))

    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def transit_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return duration_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(transit_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    # PATH_CHEAPEST_ARC gives a fast, good initial solution
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    # GUIDED_LOCAL_SEARCH improves the initial solution iteratively
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    # Hard 2-second cap — always responds promptly for N ≤ 15
    search_params.time_limit.seconds = 2

    solution = routing.SolveWithParameters(search_params)

    if not solution:
        # Graceful fallback: return nodes in original order
        return list(range(n))

    order: list[int] = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))

    return order
