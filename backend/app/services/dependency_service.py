"""
Dependency service: validates and creates task dependencies.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Dependency, Task
from app.schemas import DependencyCreate
from app.utils.cycle_detection import has_cycle


class DependencyServiceError(Exception):
    """Custom exception for dependency validation errors."""
    pass


async def validate_and_create_dependency(
    db: AsyncSession, data: DependencyCreate
) -> Dependency:
    """
    Validate a new dependency and create it if valid.

    Checks:
    1. Both tasks exist and belong to the same project.
    2. No self-dependency.
    3. No duplicate dependency.
    4. No cycle in the dependency graph.
    """
    # 1. Verify tasks exist and belong to the project
    pred_task = await db.get(Task, data.predecessor_id)
    succ_task = await db.get(Task, data.successor_id)

    if not pred_task:
        raise DependencyServiceError(
            f"Predecessor task {data.predecessor_id} not found"
        )
    if not succ_task:
        raise DependencyServiceError(
            f"Successor task {data.successor_id} not found"
        )
    if pred_task.project_id != data.project_id:
        raise DependencyServiceError(
            "Predecessor task does not belong to the specified project"
        )
    if succ_task.project_id != data.project_id:
        raise DependencyServiceError(
            "Successor task does not belong to the specified project"
        )

    # 2. Check for duplicates
    stmt = select(Dependency).where(
        Dependency.predecessor_id == data.predecessor_id,
        Dependency.successor_id == data.successor_id,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise DependencyServiceError(
            "This dependency already exists"
        )

    # 3. Cycle detection
    stmt = select(
        Dependency.predecessor_id, Dependency.successor_id
    ).where(Dependency.project_id == data.project_id)
    result = await db.execute(stmt)
    existing_edges = [(row[0], row[1]) for row in result.all()]

    if has_cycle(existing_edges, (data.predecessor_id, data.successor_id)):
        raise DependencyServiceError(
            "Adding this dependency would create a circular dependency"
        )

    # 4. Create
    dep = Dependency(
        project_id=data.project_id,
        predecessor_id=data.predecessor_id,
        successor_id=data.successor_id,
        dependency_type=data.dependency_type.value,
    )
    db.add(dep)
    await db.flush()
    await db.refresh(dep)
    return dep
