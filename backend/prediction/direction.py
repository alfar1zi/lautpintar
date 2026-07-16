import math
from typing import Optional


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlambda/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def bearing_degrees(lat1, lon1, lat2, lon2):
    lat1r, lon1r, lat2r, lon2r = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2r - lon1r
    x = math.sin(dlon) * math.cos(lat2r)
    y = math.cos(lat1r) * math.sin(lat2r) - math.sin(lat1r) * math.cos(lat2r) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def bearing_to_text_id(bearing):
    sectors = [
        (22.5, "Utara"), (67.5, "Timur Laut"), (112.5, "Timur"),
        (157.5, "Tenggara"), (202.5, "Selatan"), (247.5, "Barat Daya"),
        (292.5, "Barat"), (337.5, "Barat Laut"), (360.1, "Utara"),
    ]
    for threshold, name in sectors:
        if bearing < threshold:
            return name
    return "Utara"


def find_top_recommendation(cells, harbor_lat, harbor_lng, max_radius_km=150.0):
    candidates = [
        c for c in cells
        if c.category in ("HIGH", "MEDIUM")
        and haversine_km(harbor_lat, harbor_lng, c.lat, c.lng) <= max_radius_km
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda c: (0 if c.category == "HIGH" else 1, haversine_km(harbor_lat, harbor_lng, c.lat, c.lng)))
    best = candidates[0]
    dist_km = haversine_km(harbor_lat, harbor_lng, best.lat, best.lng)
    bearing = bearing_degrees(harbor_lat, harbor_lng, best.lat, best.lng)
    direction = bearing_to_text_id(bearing)
    return {
        "zone_lat": best.lat, "zone_lng": best.lng,
        "category": best.category, "fps": best.fps,
        "direction": direction, "bearing_degrees": round(bearing, 1),
        "distance_km": round(dist_km, 1),
        "summary": f"Menuju arah {direction}, sekitar {dist_km:.0f} km dari pelabuhan Anda.",
    }
