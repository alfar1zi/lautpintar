from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db
from backend.db.models import Harbor
from backend.prediction.direction import haversine_km

router = APIRouter()

@router.get("/list")
async def list_harbors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Harbor))
    harbors = result.scalars().all()
    return [{"id": str(h.id), "name": h.name, "lat": float(h.lat), "lng": float(h.lng), "province": h.province} for h in harbors]

@router.get("/nearest")
async def get_nearest_harbor(lat: float, lng: float, db: AsyncSession = Depends(get_db)):
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="Koordinat tidak valid")
    result = await db.execute(select(Harbor))
    harbors = result.scalars().all()
    if not harbors:
        raise HTTPException(status_code=404, detail="Tidak ada pelabuhan")
    nearest = min(harbors, key=lambda h: haversine_km(lat, lng, float(h.lat), float(h.lng)))
    distance = haversine_km(lat, lng, float(nearest.lat), float(nearest.lng))
    return {"id": str(nearest.id), "name": nearest.name, "lat": float(nearest.lat), "lng": float(nearest.lng), "distance_km": round(distance, 1)}
