"""
Dependency injection helpers for authentication, authorization, and CSRF protection.
"""
import logging
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.config import settings
from app.models import User
from app.utils.security import verify_jwt_token

logger = logging.getLogger(__name__)

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the currently logged-in user from the HttpOnly access_token cookie.
    Fails close (returns 401) on missing or invalid session.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Access token cookie missing.",
        )
    
    payload = verify_jwt_token(token, settings.resolved_secret_key)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token.",
        )
    
    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )
    
    return user

async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Enforce role-based access control (RBAC). Only permits users with 'admin' role.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Admin role required.",
        )
    return current_user

async def verify_csrf(request: Request):
    """
    CSRF verification using Double Submit Cookie technique.
    Required for state-changing requests (POST, PUT, DELETE, PATCH).
    Exempts public endpoints: login, register.
    """
    method = request.method
    if method in ["GET", "HEAD", "OPTIONS", "TRACE"]:
        return

    # Exempt login and register from CSRF validation
    path = request.url.path
    if path.endswith("/auth/login") or path.endswith("/auth/register"):
        return

    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("X-CSRF-Token")

    if not csrf_cookie:
        logger.warning("CSRF cookie is missing.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed: Cookie missing.",
        )

    if not csrf_header:
        logger.warning("CSRF header is missing.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed: Custom header missing.",
        )

    if csrf_cookie != csrf_header:
        logger.warning("CSRF cookie and header values mismatch.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed: Token mismatch.",
        )

