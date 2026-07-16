import math
from dataclasses import dataclass
from typing import Optional
from .species_config import SPECIES_CONFIG


@dataclass
class PredictionCell:
    lat: float
    lng: float
    fps: float
    category: str
    reasoning: str
    sst_celsius: Optional[float]
    chlorophyll: Optional[float]
    current_speed: Optional[float]
    depth_m: Optional[float]
    is_upwelling_zone: bool
    is_thermal_front: bool
    is_fishing_ban: bool


def calculate_fps(sst_celsius, chlorophyll, current_u, current_v, wind_speed_ms, wave_height_m, depth_m, is_upwelling, is_thermal_front, is_fishing_ban, species):
    cfg = SPECIES_CONFIG[species]
    reasons = []

    # Safety first
    if wind_speed_ms is not None and wind_speed_ms > 15.0:
        return 0.0, "UNSAFE", f"Angin {wind_speed_ms:.0f} m/s. Jangan berlayar."
    if wave_height_m is not None and wave_height_m > 2.5:
        return 0.0, "UNSAFE", f"Gelombang {wave_height_m:.1f} meter. Jangan berlayar."
    if is_fishing_ban:
        return 0.0, "AVOID", "Zona larangan tangkap (KKP)."

    # Wind penalty
    wind_penalty = 1.0
    if wind_speed_ms is not None and wind_speed_ms > 10.0:
        wind_penalty = 0.75
        reasons.append("angin kencang, hati-hati")

    # Depth penalty
    depth_penalty = 1.0
    if depth_m is not None:
        if depth_m < 5:
            return 0.0, "AVOID", "Bukan perairan layar."
        if depth_m > cfg["depth_max_m"]:
            depth_penalty = 0.65

    # SST score
    if sst_celsius is None:
        sst_score = 0.50
    elif sst_celsius < cfg["sst_lethal_min"] or sst_celsius > cfg["sst_lethal_max"]:
        return 0.0, "AVOID", f"Suhu {sst_celsius:.1f}°C di luar toleransi."
    elif cfg["sst_optimal_min"] <= sst_celsius <= cfg["sst_optimal_max"]:
        sst_score = 1.0
        reasons.append(f"suhu {sst_celsius:.1f}°C ideal")
    else:
        sst_score = 0.6
        reasons.append(f"suhu {sst_celsius:.1f}°C kurang ideal")

    # Chlorophyll score
    if chlorophyll is None or chlorophyll < 0:
        chl_score = 0.50
    elif chlorophyll < cfg["chl_min_mg_m3"]:
        chl_score = 0.10
    else:
        chl_score = min(1.0, math.log1p(chlorophyll) / math.log1p(cfg["chl_optimal_mg_m3"] * 3))

    # Current score
    if current_u is not None and current_v is not None:
        current_speed = math.sqrt(current_u**2 + current_v**2)
        if 0.05 <= current_speed <= 0.50:
            current_score = 1.0
        else:
            current_score = 0.5
    else:
        current_score = 0.50

    upwelling_score = cfg["upwelling_affinity"] if is_upwelling else 0.0

    fps_raw = (
        sst_score * cfg["weight_sst"]
        + chl_score * cfg["weight_chl"]
        + current_score * cfg["weight_current"]
        + upwelling_score * cfg["weight_upwelling_bonus"]
    )

    thermal_multiplier = 1.15 if is_thermal_front else 1.0
    fps = fps_raw * thermal_multiplier * wind_penalty * depth_penalty
    fps = round(min(1.0, max(0.0, fps)), 3)

    if fps >= 0.70:
        category = "HIGH"
    elif fps >= 0.45:
        category = "MEDIUM"
    elif fps >= 0.20:
        category = "LOW"
    else:
        category = "AVOID"

    return fps, category, ". ".join(reasons)
