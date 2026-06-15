# tempops Backend

FastAPI backend for tempops.

Slogan: **Predict project delays before they happen.**

## Requirements

- Python 3.10+
- SQLite for local development
- PostgreSQL 16 recommended for production

## Environment

Create `backend/.env`:

```bash
PROJECT_NAME="tempops API"
PROJECT_VERSION="1.0.0"
API_PREFIX="/api/v1"
DEBUG=false

DATABASE_URL="sqlite+aiosqlite:///./tempops.db"
SECRET_KEY="replace-with-a-long-random-secret"
CORS_ORIGINS='["http://localhost:3005","http://127.0.0.1:3005"]'
FRONTEND_URL="http://localhost:3005"
HOST="127.0.0.1"
PORT=8000
RATE_LIMIT="100/minute"
```

PostgreSQL example:

```bash
DATABASE_URL="postgresql+asyncpg://tempops_user:password@db-host:5432/tempops"
```

## Development

```bash
cd backend
pip install -r requirements.txt
python seed_data.py
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open API docs:

```text
http://127.0.0.1:8000/docs
```

## Production

Use a process manager or container runtime:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Production checklist:

- Set a permanent `SECRET_KEY`.
- Use PostgreSQL, not SQLite.
- Set `CORS_ORIGINS` to the frontend domain.
- Put the API behind HTTPS.
- Run database migrations before traffic.
- Keep `DEBUG=false`.

## Main API Areas

- Auth: `/api/v1/auth/*`
- Projects: `/api/v1/projects`
- Gantt: `/api/v1/projects/{project_id}/gantt`
- Tasks: `/api/v1/tasks`
- Dependencies: `/api/v1/dependencies`
- Workflow: notifications, activity logs, automation, templates, search
- Integrations: `/api/v1/integrations`
- Admin users: `/api/v1/users`

## Data Isolation

Projects and tasks are scoped by the authenticated `user_id`.
Admin users can manage accounts and inspect per-user environment summaries, but normal project APIs only return the current user's data.

## Verification

```bash
python -m compileall app
```
