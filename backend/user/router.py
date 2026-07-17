from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from backend.auth.models import UserResponse
from backend.auth.service import clear_auth_cookies, get_current_user
from backend.db.database import get_db
from backend.db.models import User
from backend.prediction.species_config import SPECIES_CONFIG

router = APIRouter()

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    harbor_id: Optional[UUID] = None
    default_species: Optional[str] = None

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_me(body: UpdateUserRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.harbor_id is not None:
        current_user.harbor_id = body.harbor_id
    if body.default_species is not None:
        if body.default_species not in SPECIES_CONFIG:
            raise HTTPException(status_code=400, detail="Species tidak valid")
        current_user.default_species = body.default_species
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.delete("/account")
async def delete_account(response: Response, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.delete(current_user)
    await db.commit()
    clear_auth_cookies(response)
    return {"message": "Akun berhasil dihapus"}
