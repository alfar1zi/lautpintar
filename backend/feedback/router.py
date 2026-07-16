from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.auth.service import get_current_user
from backend.db.database import get_db
from backend.db.models import CatchReport, User

router = APIRouter()

class TripReportRequest(BaseModel):
    trip_date: date
    species: str
    catch_kg: Optional[Decimal] = None

@router.post("/trip")
async def report_trip(body: TripReportRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    report = CatchReport(user_id=current_user.id, trip_date=body.trip_date, species=body.species, catch_kg=body.catch_kg)
    db.add(report)
    await db.commit()
    return {"message": "Laporan tersimpan", "id": str(report.id)}

@router.get("/trips")
async def list_trips(limit: int = Query(default=20, ge=1, le=100), offset: int = Query(default=0, ge=0),
                     current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(CatchReport.id)).where(CatchReport.user_id == current_user.id))).scalar() or 0
    rows = (await db.execute(select(CatchReport).where(CatchReport.user_id == current_user.id).order_by(desc(CatchReport.trip_date)).offset(offset).limit(limit))).scalars().all()
    return {"trips": [{"id": str(r.id), "trip_date": r.trip_date, "species": r.species, "catch_kg": r.catch_kg} for r in rows], "total": total}
