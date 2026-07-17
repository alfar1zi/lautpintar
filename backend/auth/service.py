import hashlib, secrets
import bcrypt
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.database import get_db

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token() -> str:
    return secrets.token_urlsafe(32)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def _cookie_secure() -> bool:
    return settings.APP_ENV != "development"

def set_auth_cookies(response: Response, access_token: str) -> None:
    response.set_cookie(key=ACCESS_COOKIE, value=f"Bearer {access_token}",
                        httponly=True, secure=_cookie_secure(), samesite="lax", max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)

def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    max_age = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    response.set_cookie(key=REFRESH_COOKIE, value=refresh_token,
                        httponly=True, secure=_cookie_secure(), samesite="lax", max_age=max_age)

def refresh_token_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=ACCESS_COOKIE, httponly=True, samesite="lax", secure=_cookie_secure())
    response.delete_cookie(key=REFRESH_COOKIE, httponly=True, samesite="lax", secure=_cookie_secure())

async def get_current_user(access_token: str | None = Cookie(default=None), db: AsyncSession = Depends(get_db)):
    from backend.db.models import User
    from sqlalchemy import select
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not access_token:
        raise exc
    token = access_token.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM], options={"require": ["exp"], "verify_exp": True})
        user_id = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc
    try: uid = UUID(user_id)
    except ValueError: raise exc
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise exc
    return user
