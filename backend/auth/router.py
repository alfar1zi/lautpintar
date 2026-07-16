from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.models import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from backend.auth.service import (
    REFRESH_COOKIE, clear_auth_cookies, create_access_token, create_refresh_token,
    hash_password, hash_token, set_auth_cookies, set_refresh_cookie, verify_password,
)
from backend.db.database import get_db
from backend.db.models import RefreshToken, User

router = APIRouter(prefix="")


async def _store_refresh_token(session: AsyncSession, user_id, raw_refresh: str) -> None:
    session.add(RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc),
    ))


async def _issue_tokens(session: AsyncSession, user: User, response: Response) -> None:
    access_token = create_access_token(str(user.id))
    raw_refresh = create_refresh_token()
    await _store_refresh_token(session, user.id, raw_refresh)
    await session.commit()
    set_auth_cookies(response, access_token)
    set_refresh_cookie(response, raw_refresh)


@router.post("/register", response_model=UserResponse)
async def register(body: RegisterRequest, response: Response, session: AsyncSession = Depends(get_db)):
    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=body.email, password_hash=hash_password(body.password),
        full_name=body.full_name, harbor_id=body.harbor_id, default_species=body.default_species,
    )
    session.add(user)
    await session.flush()
    await _issue_tokens(session, user, response)
    return user


@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, response: Response, session: AsyncSession = Depends(get_db)):
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    await _issue_tokens(session, user, response)
    return user


@router.post("/logout", response_model=TokenResponse)
async def logout(response: Response, session: AsyncSession = Depends(get_db)):
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if raw_refresh:
        token_hash = hash_token(raw_refresh)
        result = await session.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        db_token = result.scalar_one_or_none()
        if db_token:
            db_token.revoked = True
            await session.commit()
    clear_auth_cookies(response)
    return TokenResponse(message="logged out")
