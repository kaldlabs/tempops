# tempops Frontend

tempops web app built with Next.js, React, TanStack Query, and Zustand.

Slogan: **Predict project delays before they happen.**

## Requirements

- Node.js 24+ recommended
- Backend API running on `http://127.0.0.1:8000`

## Environment

Create `frontend/.env.local`:

```bash
TEMPOPS_API_ORIGIN=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=/api/v1
NEXT_ALLOWED_DEV_ORIGINS=localhost:3005,127.0.0.1:3005
```

`TEMPOPS_API_ORIGIN` is used by `next.config.ts` rewrites so the browser can call `/api/v1/*` without hardcoding a server IP.

## Development

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3005
```

## Production Build

```bash
cd frontend
npm run lint
npm run build
npm run start
```

## Deployment

Recommended options:

- Deploy with Docker Compose from the repository root.
- Deploy standalone Next.js output behind Nginx/Caddy.
- Deploy to a Node host with environment variables set by the platform.

For a custom production domain:

```bash
TEMPOPS_API_ORIGIN=https://api.example.com
NEXT_PUBLIC_API_URL=/api/v1
NEXT_ALLOWED_DEV_ORIGINS=localhost:3005
```

If the frontend and backend are hosted on different domains, also set backend `CORS_ORIGINS`.

## Key Routes

- `/login`
- `/projects`
- `/projects/[id]`
- `/calendar`
- `/reports`
- `/integrations`
- `/templates`
- `/admin`

## Verification

```bash
npm run lint
npm run build
```
