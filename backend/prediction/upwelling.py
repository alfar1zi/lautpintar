from pathlib import Path
import numpy as np
import xarray as xr
from scipy import ndimage
import structlog

log = structlog.get_logger()


def load_monthly_climatology(month: int):
    filepath = Path(f"backend/data/climatology/sst_monthly_{month:02d}.nc")
    if not filepath.exists():
        return None
    try:
        ds = xr.open_dataset(filepath)
        clim = ds["analysed_sst"]
        rename = {}
        if "latitude" in clim.coords and "lat" not in clim.coords:
            rename["latitude"] = "lat"
        if "longitude" in clim.coords and "lon" not in clim.coords:
            rename["longitude"] = "lon"
        if rename:
            clim = clim.rename(rename)
        if "time" in clim.dims:
            clim = clim.isel(time=0)
        return clim
    except Exception as e:
        log.warning("climatology_load_error", month=month, error=str(e))
        return None


def detect_upwelling(sst_grid_kelvin, lat_coords, lon_coords, chl_grid, current_u_grid, current_v_grid, month, region_key):
    from .region_config import INDONESIA_REGIONS
    region = INDONESIA_REGIONS.get(region_key, {})
    is_peak = month in region.get("peak_upwelling_months", [])
    sst_safe = np.nan_to_num(sst_grid_kelvin, nan=0.0)
    clim = load_monthly_climatology(month)
    if clim is not None:
        try:
            clim_interp = clim.interp(lat=lat_coords, lon=lon_coords).values
            sst_anomaly = sst_safe - np.nan_to_num(clim_interp, nan=0.0)
            is_cold = sst_anomaly < -0.5
        except Exception:
            is_cold = np.zeros(sst_grid_kelvin.shape, dtype=bool)
    else:
        is_cold = np.zeros(sst_grid_kelvin.shape, dtype=bool)
    chl_safe = np.nan_to_num(chl_grid, nan=0.0)
    is_high_chl = chl_safe > 0.30
    du_dx = np.gradient(np.nan_to_num(current_u_grid, nan=0.0), axis=1)
    dv_dy = np.gradient(np.nan_to_num(current_v_grid, nan=0.0), axis=0)
    divergence = du_dx + dv_dy
    is_divergent = divergence > 0.0
    signal = is_cold.astype(int) + is_high_chl.astype(int) + is_divergent.astype(int)
    required = 2 if is_peak else 3
    mask = signal >= required
    mask = ndimage.binary_dilation(mask, iterations=1)
    return mask


def detect_thermal_fronts(sst_grid_kelvin):
    sst_clean = np.nan_to_num(sst_grid_kelvin, nan=float(np.nanmean(sst_grid_kelvin)) if not np.all(np.isnan(sst_grid_kelvin)) else 0.0)
    gx = ndimage.sobel(sst_clean, axis=1)
    gy = ndimage.sobel(sst_clean, axis=0)
    mag = np.hypot(gx, gy)
    if mag.max() > 0:
        mag = mag / mag.max()
    return mag


def build_thermal_front_mask(gradient_magnitude, threshold=0.60):
    return gradient_magnitude >= threshold
