# tempops

**Predict project delays before they happen.**

tempops is a commercial Gantt planning workspace for project timelines, dependencies, workload, risk signals, activity logs, notifications, integrations, templates, and admin-managed user environments.

## Stack

- Backend: FastAPI, SQLAlchemy async, Pydantic v2
- Frontend: Next.js, React, TanStack Query, Zustand
- Database: SQLite for local development, PostgreSQL for production
- Realtime-ready: WebSocket project channels
- Workflow: audit logs, notification center, automation rules, template gallery, global search

## Local Development

Backend:

```bash
cd backend
pip install -r requirements.txt
python seed_data.py
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3005
```

## Environment

Backend uses `backend/.env`.

Frontend uses `frontend/.env.local`.

Recommended local frontend env:

```bash
TEMPOPS_API_ORIGIN=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=/api/v1
NEXT_ALLOWED_DEV_ORIGINS=localhost:3005,127.0.0.1:3005
```

No server IP is required in source code. Use environment variables for server-specific hosts.

## Docker Compose

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f tempops-api
```

Stop:

```bash
docker compose down
```

## Production Notes

- Use PostgreSQL for `DATABASE_URL`.
- Set a permanent `SECRET_KEY`.
- Set backend `CORS_ORIGINS` to your frontend domain.
- Set frontend `TEMPOPS_API_ORIGIN` to your API origin.
- Run both services behind HTTPS.
- Keep generated files such as `.next`, `node_modules`, databases, and logs out of Git.

## Default Accounts

Seed data creates:

- Admin: `admin` / `adminpass123`
- User: `user` / `userpass123`

Change these before any real deployment.

## Verification

Backend:

```bash
cd backend
python -m compileall app
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## More Docs

- Backend: `backend/README.md`
- Frontend: `frontend/README.md`
