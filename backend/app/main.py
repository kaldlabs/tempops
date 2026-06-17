"""
tempops API - FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.database import close_db, init_db
from app.routers import ai, dependencies, gantt, integrations, ml, projects, realtime, tasks, auth, users, workflow
from app.routers.auth_deps import verify_csrf
from app.schemas import HealthResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Rate Limiter ───────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT])


# ── Lifespan ───────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB tables. Shutdown: close DB connections."""
    logger.info("Starting tempops API v%s", settings.PROJECT_VERSION)
    logger.info("Database: %s", "SQLite" if settings.is_sqlite else "PostgreSQL")
    await init_db()
    logger.info("Database tables initialized")
    yield
    await close_db()
    logger.info("Database connections closed")


# ── App ────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description=(
        "tempops - Predict project delays before they happen.\n\n"
        "Commercial Gantt planning API for projects, tasks, dependencies, "
        "audit logs, notifications, templates, and schedule-risk workflows."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Rate Limiter Middleware ────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────
# Ensure FRONTEND_URL is explicitly allowed for cross-domain CORS preflight
allowed_origins = list(settings.CORS_ORIGINS)
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)


# ── Security Headers Middleware ────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        await verify_csrf(request)
    except HTTPException as exc:
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )
    else:
        response: Response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )
    # TODO(security): Add strict CSP header when deploying with auth
    return response


# ── Routers ────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(users.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)
app.include_router(dependencies.router, prefix=settings.API_PREFIX)
app.include_router(gantt.router, prefix=settings.API_PREFIX)
app.include_router(integrations.router, prefix=settings.API_PREFIX)
app.include_router(ai.router, prefix=settings.API_PREFIX)
app.include_router(ml.router, prefix=settings.API_PREFIX)
app.include_router(workflow.router, prefix=settings.API_PREFIX)
app.include_router(realtime.router)


# ── Health Check ───────────────────────────────────────────────────────
@app.get("/api/v1/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=settings.PROJECT_VERSION,
        database="sqlite" if settings.is_sqlite else "postgresql",
    )


# ── Root ───────────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    """API root - redirects to docs."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "docs": "/docs",
        "health": "/api/v1/health",
    }
