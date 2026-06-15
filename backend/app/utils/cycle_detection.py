"""
DFS-based cycle detection for task dependency graphs.
Prevents creating circular dependencies (e.g. A→B→C→A).
"""
from collections import defaultdict


def has_cycle(
    edges: list[tuple[str, str]],
    new_edge: tuple[str, str],
) -> bool:
    """
    Check if adding new_edge creates a cycle in the directed graph.

    Args:
        edges: Existing edges as (predecessor_id, successor_id) pairs.
        new_edge: The proposed new edge to add.

    Returns:
        True if adding the edge would create a cycle.
    """
    graph: dict[str, list[str]] = defaultdict(list)
    for pred, succ in edges:
        graph[pred].append(succ)

    # Add the proposed edge
    pred_new, succ_new = new_edge
    graph[pred_new].append(succ_new)

    # DFS from the successor of the new edge to see if we can reach
    # the predecessor (which would mean a cycle exists)
    visited: set[str] = set()
    stack: list[str] = [succ_new]

    while stack:
        node = stack.pop()
        if node == pred_new:
            return True
        if node in visited:
            continue
        visited.add(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                stack.append(neighbor)

    return False
