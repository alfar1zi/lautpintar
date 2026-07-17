from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import get_current_user
from backend.cache.redis_client import get_json, get_last_update, get_redis, get_tile
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

    if lat is not None and lng is not None:
        region_key = get_region_for_harbor(lat, lng)
        if not region_key:
            raise HTTPException(status_code=400, detail="Lokasi di luar cakupan")
        harbor_lat, harbor_lng = lat, lng
        harbor_data = {"id": None, "name": "Lokasi Saya", "lat": lat, "lng": lng}
    else:
        result = await db.execute(select(Harbor).filter(Harbor.id == harbor_id))
        harbor = result.scalars().first()
        if not harbor:
            raise HTTPException(status_code=404, detail="Pelabuhan tidak ditemukan")
        region_key = get_region_for_harbor(float(harbor.lat), float(harbor.lng))
        if not region_key:
            raise HTTPException(status_code=400, detail="Pelabuhan di luar cakupan")
        harbor_lat, harbor_lng = float(harbor.lat), float(harbor.lng)
        harbor_data = {"id": str(harbor.id), "name": harbor.name, "lat": harbor_lat, "lng": harbor_lng}

    cache_key = f"prediction:{species}:{region_key}"
    cells_data = await get_json(cache_key)
    if not cells_data:
        raise HTTPException(status_code=503, detail="Prediksi belum tersedia, coba lagi")

    cells = cells_data
    top_rec = find_top_recommendation(cells, harbor_lat, harbor_lng, float(radius_km))
    bait_info = BAIT_RECOMMENDATIONS.get(species, {})

    sorted_cells = sorted(
        [c for c in cells if c.get("category") in ("HIGH", "MEDIUM")],
        key=lambda c: (0 if c["category"] == "HIGH" else 1, haversine_km(harbor_lat, harbor_lng, c.get("lat"), c.get("lng")))
    )
    zones = sorted_cells[:20]

    last_update = await get_last_update()
    return {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "species": species,
        "harbor": harbor_data,
        "top_recommendation": top_rec,
        "bait_info": bait_info,
        "data_freshness_utc": last_update or datetime.now(timezone.utc).isoformat(),
        "zones": zones,
    }


@router.get("/tile/{z}/{x}/{y}.png")
@limiter.limit("200/minute")
async def get_prediction_tile(request: Request, z: int, x: int, y: int, species: str = "tongkol"):
    if species not in VALID_SPECIES:
        species = "tongkol"
    if not (7 <= z <= 12):
        return Response(content=b'')
    cache_key = f"tile:{species}:{z}:{x}:{y}"
    tile_bytes = await get_tile(cache_key)
    if tile_bytes:
        return Response(content=tile_bytes, media_type="image/png")
    return Response(content=b'')


@router.get("/weather")
@limiter.limit(f"{settings.RATE_LIMIT_PREDICTION_PER_MINUTE}/minute")
async def get_weather(request: Request, lat: float, lng: float, current_user: User = Depends(get_current_user)):
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="Koordinat tidak valid")
    region_key = get_region_for_harbor(lat, lng)
    if not region_key:
        raise HTTPException(status_code=400, detail="Lokasi di luar cakupan")
    redis = await get_redis()
    raw = await redis.get(f"weather:{region_key}")
    if not raw:
        return {"weather_available": False, "wind_speed_ms": None, "wave_height_m": None}
    import json
    data = json.loads(raw)
    return {"weather_available": True, "wind_speed_ms": data.get("wind_speed_ms"), "wave_height_m": data.get("wave_height_m"), "wind_direction_deg": data.get("wind_direction_deg")}


@router.get("/status")
async def get_status(request: Request):
    redis = await get_redis()
    last_update = await get_last_update()
    regions_status = {}
    for region_key, region in INDONESIA_REGIONS.items():
        primary_species = region["dominant_species"][0]
        cache_key = f"prediction:{primary_species}:{region_key}"
        has_data = await redis.exists(cache_key)
        regions_status[region_key] = "ok" if has_data else "no_data"
    scheduler_running = hasattr(request.app.state, "scheduler") and request.app.state.scheduler.running
    return {"last_update": last_update, "regions": regions_status, "scheduler_running": scheduler_running}
