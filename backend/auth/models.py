from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str
    harbor_id: Optional[UUID] = None
    default_species: str = "tongkol"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    full_name: Optional[str]
    harbor_id: Optional[UUID]
    default_species: str
    created_at: datetime


class TokenResponse(BaseModel):
    message: str
