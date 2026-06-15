"""In-process realtime hub with Redis Pub/Sub compatible event shape.

Production path:
- Keep this interface.
- Replace the in-memory `broadcast_project` implementation with Redis Pub/Sub.
- Run one subscriber per API process and fan messages to local WebSocket clients.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ProjectConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[project_id].add(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket) -> None:
        self._rooms[project_id].discard(websocket)
        if not self._rooms[project_id]:
            self._rooms.pop(project_id, None)

    async def broadcast_project(self, project_id: str, event: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for websocket in self._rooms.get(project_id, set()).copy():
            try:
                await websocket.send_json(event)
            except RuntimeError:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(project_id, websocket)


project_ws_manager = ProjectConnectionManager()
