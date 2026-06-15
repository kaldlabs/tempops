"""
AI Service - Stub for future Qwen3.5-27B-Opus integration.

This module will contain the AI pipeline logic:
- Task Breakdown (WBS): Takes a high-level task and decomposes it into sub-tasks.
- NL-to-Gantt: Converts natural language commands to structured Gantt operations.

Integration Details (from ai_model_it.md):
- Model: Qwen3.5-27B-Opus via vLLM/Ollama or Private Endpoint
- Vector DB: Qdrant for semantic search context
- Inference Settings: temperature=0.0, top_p=0.1, max_tokens=2048
- Output Format: JSON structured output (response_format={"type": "json_object"})

This is intentionally left as stubs. Implementation will be developed later.
"""


class AIService:
    """
    Placeholder AI service for future integration with Qwen3.5-27B-Opus.

    Architecture reference:
    [User Input] → [FastAPI Gateway] → [Qdrant Vector DB] → [Prompt Formatter]
    → [Qwen3.5-27B Inference Engine] → [JSON Structured Output]
    → [PostgreSQL + Next.js Gantt Chart]
    """

    async def breakdown_task(self, task_name: str, context: str | None = None) -> dict:
        """
        AI Task Breakdown (WBS) - Stub.

        When implemented, this will:
        1. Format the task into a WBS system prompt
        2. Send to Qwen3.5-27B with temperature=0.0
        3. Parse JSON response into sub_tasks array
        4. Return structured breakdown

        Expected output format:
        {
            "sub_tasks": [
                {
                    "name": "...",
                    "description": "...",
                    "duration_days": 2,
                    "sequence_order": 1
                }
            ]
        }
        """
        raise NotImplementedError(
            "AI Task Breakdown not yet implemented. "
            "See ai_model_it.md Section 2 for specifications."
        )

    async def nl_to_gantt(self, command: str, project_id: str) -> dict:
        """
        Natural Language to Gantt - Stub.

        When implemented, this will:
        1. Use Qdrant semantic search to find referenced tasks
        2. Build context-enriched prompt with current date + dependencies
        3. Send to Qwen3.5-27B for structured command extraction
        4. Return action (CREATE_TASK, UPDATE_TASK, etc.) with structured data

        Expected output format:
        {
            "action": "CREATE_TASK",
            "data": {
                "name": "...",
                "start_date": "2026-06-22",
                "end_date": "2026-06-25",
                "dependencies": [{"predecessor_id": "...", "type": "FS"}]
            }
        }
        """
        raise NotImplementedError(
            "NL-to-Gantt not yet implemented. "
            "See ai_model_it.md Section 3 for specifications."
        )


ai_service = AIService()
