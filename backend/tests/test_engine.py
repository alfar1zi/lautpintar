from backend.prediction.engine import calculate_fps
from backend.prediction.species_config import SPECIES_CONFIG

def _base_kwargs(**overrides):
    defaults = {
        "sst_celsius": 28.0, "chlorophyll": 0.5,
        "current_u": 0.2, "current_v": 0.1,
        "wind_speed_ms": 5.0, "wave_height_m": 0.5,
        "depth_m": 100.0, "is_upwelling": False,
        "is_thermal_front": False, "is_fishing_ban": False,
        "species": "tongkol",
    }
    defaults.update(overrides)
    return defaults

def test_tongkol_optimal():
    fps, cat, _ = calculate_fps(**_base_kwargs())
    assert fps >= 0.70
    assert cat == "HIGH"

def test_sst_below_lethal():
    _, cat, _ = calculate_fps(**_base_kwargs(sst_celsius=15.0))
    assert cat == "AVOID"

def test_unsafe_wind():
    fps, cat, _ = calculate_fps(**_base_kwargs(wind_speed_ms=16.0))
    assert cat == "UNSAFE"
    assert fps == 0.0

def test_fishing_ban():
    fps, cat, _ = calculate_fps(**_base_kwargs(is_fishing_ban=True))
    assert cat == "AVOID"
    assert fps == 0.0

def test_thermal_multiplier():
    _, _, r1 = calculate_fps(**_base_kwargs(is_thermal_front=False))
    _, _, r2 = calculate_fps(**_base_kwargs(is_thermal_front=True))
    assert r2 is not None

def test_weights_sum():
    for name, cfg in SPECIES_CONFIG.items():
        total = cfg["weight_sst"] + cfg["weight_chl"] + cfg["weight_current"] + cfg["weight_upwelling_bonus"]
        assert abs(total - 1.0) < 1e-9
