from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import get_current_user
from backend.config import settings
from backend.db.database import get_db
from backend.db.models import Harbor, User
from backend.middleware.rate_limiter import limiter
from backend.prediction.bait_config import BAIT_RECOMMENDATIONS
from backend.prediction.direction import find_top_recommendation, haversine_km
from backend.prediction.region_config import INDONESIA_REGIONS, get_region_for_harbor
from backend.prediction.species_config import SPECIES_CONFIG

router = APIRouter()
VALID_SPECIES = set(SPECIES_CONFIG.keys())


@router.get("/zone")
@limiter.limit(f"{settings.RATE_LIMIT_PREDICTION_PER_MINUTE}/minute")
async def get_zone(
    request: Request,
    harbor_id: Optional[UUID] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    species: str = "tongkol",
    radius_km: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if species not in VALID_SPECIES:
        raise HTTPException(status_code=400, detail=f"Species invalid. Pilihan: {', '.join(sorted(VALID_SPECIES))}")
    if not (10 <= radius_km <= 500):
        raise HTTPException(status_code=400, detail="radius_km harus antara 10 dan 500")
    if harbor_id is None and (lat is None or lng is None):
        raise HTTPException(status_code=400, detail="harbor_id atau koordinat harus diberikan")

    # Kurang logic mapping region + fetch dari cache/redis
    # Buat return dummy dulu
    return {
        "species": species,
        "zones": [],
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
