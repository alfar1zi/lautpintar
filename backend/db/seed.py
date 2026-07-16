from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Harbor

HARBOR_SEED = [
    ("PP Muara Baru", -6.120, 106.793, "DKI Jakarta", "GI03"),
    ("PP Belawan", 3.801, 98.711, "Sumatera Utara", "GI01"),
    ("PP Sibolga", 1.742, 98.782, "Sumatera Utara", "GI01"),
    ("PP Brondong", -6.883, 112.278, "Jawa Timur", "GI03"),
    ("PP Muncar", -8.440, 114.326, "Jawa Timur", "GI05"),
    ("PP Benoa", -8.748, 115.215, "Bali", "GI05"),
    ("PP Kupang", -10.163, 123.575, "NTT", "GI04"),
    ("PP Bitung", 1.443, 125.191, "Sulawesi Utara", "GI07"),
    ("PP Ambon", -3.695, 128.183, "Maluku", "GI06"),
    ("PP Sorong", -0.876, 131.262, "Papua Barat", "GI08"),
    ("PP Merauke", -8.496, 140.401, "Papua", "GI08"),
    ("PP Ternate", 0.787, 127.381, "Maluku Utara", "GI07"),
    ("PP Kendari", -3.982, 122.515, "Sulawesi Tenggara", "GI06"),
    ("PP Makassar", -5.148, 119.432, "Sulawesi Selatan", "GI05"),
    ("PP Pekalongan", -6.889, 109.675, "Jawa Tengah", "GI03"),
    ("PP Palabuhanratu", -7.014, 106.538, "Jawa Barat", "GI04"),
    ("PP Cilacap", -7.736, 109.015, "Jawa Tengah", "GI04"),
    ("PP Prigi", -8.286, 111.746, "Jawa Timur", "GI04"),
]

async def seed_harbors(session: AsyncSession) -> None:
    result = await session.execute(select(Harbor))
    if result.scalars().first():
        return
    for name, lat, lng, province, bmkg_code in HARBOR_SEED:
        session.add(Harbor(name=name, lat=lat, lng=lng, province=province, bmkg_maritime_region=bmkg_code))
    await session.commit()
