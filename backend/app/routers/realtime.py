"""Project WebSocket endpoints for collaborative Gantt updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.realtime import project_ws_manager

router = APIRouter(prefix="/ws", tags=["Realtime"])


@router.websocket("/projects/{project_id}")
async def project_socket(websocket: WebSocket, project_id: str):
    """Subscribe to updates for a single project.

    This dev implementation uses an in-process hub. The event contract is already
    Redis Pub/Sub friendly: every message carries a `type`, `project_id`, and
    payload for React Query invalidation on the client.
    """
    await project_ws_manager.connect(project_id, websocket)
    try:
        await websocket.send_json(
            {
                "type": "CONNECTED",
                "project_id": project_id,
                "message": "Realtime channel ready.",
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        project_ws_manager.disconnect(project_id, websocket)
