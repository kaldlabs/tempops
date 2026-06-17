"""
Authentication and registration router.
Manages JWT creation, secure cookies, and session state.
"""
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.config import settings
from app.models import User
from app.schemas import UserCreate, UserResponse, LoginRequest, CurrentUserResponse
from app.utils.security import hash_password, verify_password, create_jwt_token
from app.routers.auth_deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Public registration endpoint. Validates and hashes user password."""
    # Check if username or email already exists
    stmt_username = select(User).where(User.username == data.username)
    res_username = await db.execute(stmt_username)
    if res_username.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken.",
        )

    stmt_email = select(User).where(User.email == data.email)
    res_email = await db.execute(stmt_email)
    if res_email.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )

    # Hash password using Argon2
    try:
        hashed = hash_password(data.password)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        ) from val_err

    # First user registered in the system becomes Admin
    stmt_count = select(User)
    res_count = await db.execute(stmt_count)
    is_first_user = len(res_count.scalars().all()) == 0
    role = "admin" if is_first_user else "user"

    new_user = User(
        username=data.username,
        email=data.email,
        hashed_password=hashed,
        role=role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login")
async def login(
    data: LoginRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and provision HttpOnly cookie for session management,
    along with CSRF double submit token.
    """
    # Find user by username
    stmt = select(User).where(User.username == data.username)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(user.hashed_password, data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    # Create access token JWT
    payload = {"sub": user.id, "role": user.role}
    access_token = create_jwt_token(
        payload=payload,
        secret=settings.resolved_secret_key,
        expires_in_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60 if hasattr(settings, 'JWT_ACCESS_TOKEN_EXPIRE_MINUTES') else 3600
    )

    # Generate CSRF token
    csrf_token = secrets.token_hex(32)

    # Detect if we should use secure cookie (HTTPS only, except localhost /Tailscale dev might be HTTP)
    is_secure = request.url.scheme == "https"

    # Set access token cookie (HttpOnly)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/",
        max_age=3600
    )

    # Set CSRF cookie (NOT HttpOnly so JS can read and send in custom headers)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=is_secure,
        samesite="lax",
        path="/",
        max_age=3600
    )

    return {"status": "success", "user": {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    }}

@router.get("/google/login")
async def google_login(request: Request):
    """Redirects to Google OAuth2 consent screen."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Client ID not configured.")
    
    redirect_uri = str(request.url_for("google_callback"))
    # In production behind a proxy, ensure https
    if "onrender.com" in redirect_uri or settings.ENV == "production":
        redirect_uri = redirect_uri.replace("http://", "https://")

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        "&scope=openid email profile"
        "&access_type=offline"
    )
    return RedirectResponse(auth_url)

@router.get("/google/callback")
async def google_callback(
    request: Request,
    response: Response,
    code: str,
    db: AsyncSession = Depends(get_db)
):
    """Handles Google OAuth2 callback, fetches user info, and provisions JWT session."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google credentials not configured.")

    redirect_uri = str(request.url_for("google_callback"))
    # In production behind a proxy, ensure https
    if "onrender.com" in redirect_uri or settings.ENV == "production":
        redirect_uri = redirect_uri.replace("http://", "https://")
    
    # 1. Exchange code for token
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data=data)
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google token.")
        tokens = token_res.json()
        access_token = tokens.get("access_token")
        
        # 2. Fetch user info
        user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_info_res = await client.get(user_info_url, headers=headers)
        if user_info_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info.")
        user_info = user_info_res.json()
        
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email.")
        
    # 3. Find or create user
    stmt = select(User).where(User.email == email)
    res = await db.execute(stmt)
    user = res.scalars().first()
    
    if not user:
        # Create new OAuth user
        base_username = email.split("@")[0]
        username = base_username
        
        # Ensure username is unique
        stmt_username = select(User).where(User.username == username)
        while (await db.execute(stmt_username)).scalars().first():
            username = f"{base_username}_{secrets.token_hex(4)}"
            stmt_username = select(User).where(User.username == username)
            
        # Check if first user
        stmt_count = select(User)
        is_first_user = len((await db.execute(stmt_count)).scalars().all()) == 0
        role = "admin" if is_first_user else "user"
        
        # Generate an impossible-to-guess password for OAuth users
        dummy_password = secrets.token_urlsafe(32)
        hashed = hash_password(dummy_password)
        
        user = User(
            username=username,
            email=email,
            hashed_password=hashed,
            role=role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # 4. Provision Session Cookies
    payload = {"sub": user.id, "role": user.role}
    jwt_token = create_jwt_token(
        payload=payload,
        secret=settings.resolved_secret_key,
        expires_in_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60 if hasattr(settings, 'JWT_ACCESS_TOKEN_EXPIRE_MINUTES') else 3600
    )

    csrf_token = secrets.token_hex(32)
    is_secure = request.url.scheme == "https"

    response.set_cookie(
        key="access_token", value=jwt_token, httponly=True, secure=is_secure, samesite="lax", path="/", max_age=3600
    )
    response.set_cookie(
        key="csrf_token", value=csrf_token, httponly=False, secure=is_secure, samesite="lax", path="/", max_age=3600
    )

    # Redirect to frontend
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(url=f"{frontend_url}/")

@router.post("/logout")
async def logout(response: Response, request: Request):
    """Invalidate session by clearing cookies."""
    is_secure = request.url.scheme == "https"
    
    response.delete_cookie(key="access_token", path="/", secure=is_secure, samesite="lax")
    response.delete_cookie(key="csrf_token", path="/", secure=is_secure, samesite="lax")
    return {"status": "success", "message": "Logged out successfully."}

@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile of current logged-in user."""
    return {"user": current_user}
