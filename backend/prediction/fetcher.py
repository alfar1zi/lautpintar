import math, json, httpx, structlog, asyncio
from pathlib import Path
from datetime import datetime, date, timedelta
import numpy as np
import xarray as xr

from backend.config import settings

log = structlog.get_logger()


def _parse_erddap_json(data: dict, variable: str) -> dict:
    result = {}
    try:
        columns = data["table"]["columnNames"]
        rows = data["table"]["rows"]
        lat_idx = columns.index("latitude")
        lng_idx = columns.index("longitude")
        val_idx = columns.index(variable)
        for row in rows:
            val = row[val_idx]
            if val is None or (isinstance(val, float) and math.isnan(val)):
                continue
            result[(round(float(row[lat_idx]), 3), round(float(row[lng_idx]), 3))] = float(val)
    except Exception as e:
        log.warning("erddap_parse_error", variable=variable, error=str(e))
    return result


def _xarray_to_dict(da) -> dict:
    try:
        arr = da.isel(time=0) if "time" in da.dims else da
        arr = arr.isel(depth=0) if "depth" in arr.dims else arr
        lats = arr.latitude.values if "latitude" in arr.coords else arr.lat.values
        lons = arr.longitude.values if "longitude" in arr.coords else arr.lon.values
        vals = arr.values
        if vals.ndim > 2:
            vals = vals.squeeze()
        lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
        valid = ~np.isnan(vals)
        return dict(zip(
            zip(np.round(lat_grid[valid], 3).tolist(), np.round(lon_grid[valid], 3).tolist()),
            vals[valid].tolist()
        ))
    except Exception as e:
        log.warning("xarray_to_dict_error", error=str(e))
        return {}


async def fetch_mur_sst(lat_min, lat_max, lon_min, lon_max, date_str):
    url = (f"{settings.NASA_ERDDAP_BASE_URL}/griddap/jplMURSST41.json"
           f"?analysed_sst[({date_str}T09:00:00Z)]"
           f"[({lat_min}):10:({lat_max})]"
           f"[({lon_min}):10:({lon_max})]")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url)
            r.raise_for_status()
        return _parse_erddap_json(r.json(), "analysed_sst")
    except Exception as e:
        log.warning("mur_sst_fetch_failed", error=str(e))
        return {}


async def fetch_chlorophyll_8day(lat_min, lat_max, lon_min, lon_max, date_str):
    url = (f"{settings.NASA_ERDDAP_BASE_URL}/griddap/erdMH1chla8day.json"
           f"?chlorophyll[({date_str}T00:00:00Z)]"
           f"[({lat_min}):1:({lat_max})]"
           f"[({lon_min}):1:({lon_max})]")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url)
            r.raise_for_status()
        return _parse_erddap_json(r.json(), "chlorophyll")
    except Exception as e:
        log.warning("chlorophyll_fetch_failed", error=str(e))
        return {}


async def fetch_ocean_current(lat_min, lat_max, lon_min, lon_max, date_str):
    try:
        import copernicusmarine as cm
        ds = await asyncio.to_thread(
            cm.open_dataset,
            dataset_id=settings.CMEMS_DATASET_CURRENT,
            variables=["uo", "vo"],
            minimum_longitude=lon_min, maximum_longitude=lon_max,
            minimum_latitude=lat_min, maximum_latitude=lat_max,
            start_datetime=f"{date_str}T00:00:00", end_datetime=f"{date_str}T23:59:59",
            minimum_depth=0, maximum_depth=1,
            username=settings.CMEMS_USERNAME, password=settings.CMEMS_PASSWORD,
        )
        return _xarray_to_dict(ds["uo"]), _xarray_to_dict(ds["vo"])
    except Exception as e:
        log.warning("cmems_fetch_failed", error=str(e))
        return {}, {}


async def fetch_bmkg_maritime(bmkg_code, lat, lng):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            w = await client.get("https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lng, "current": "wind_speed_10m,wind_direction_10m", "wind_speed_unit": "ms"})
            w.raise_for_status()
            m = await client.get("https://marine-api.open-meteo.com/v1/marine",
                params={"latitude": lat, "longitude": lng, "current": "wave_height"})
            m.raise_for_status()
        wd = w.json().get("current", {})
        md = m.json().get("current", {})
        return {"wind_speed_ms": wd.get("wind_speed_10m", 0.0), "wave_height_m": md.get("wave_height", 0.0), "wind_direction_deg": wd.get("wind_direction_10m")}
    except Exception as e:
        log.warning("open_meteo_fetch_failed", error=str(e))
        return {"wind_speed_ms": 0.0, "wave_height_m": 0.0, "wind_direction_deg": None}


def load_gebco_subset(lat_min, lat_max, lon_min, lon_max):
    try:
        ds = xr.open_dataset("backend/data/gebco_indonesia.nc")
        subset = ds["elevation"].sel(lat=slice(lat_min, lat_max), lon=slice(lon_min, lon_max))
        vals = subset.values
        lats = subset.lat.values
        lons = subset.lon.values
        if lats.size == 0 or lons.size == 0:
            return {}
        lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
        ocean = vals < 0
        return dict(zip(
            zip(np.round(lat_grid[ocean], 3).tolist(), np.round(lon_grid[ocean], 3).tolist()),
            np.abs(vals[ocean]).tolist()
        ))
    except Exception as e:
        log.error("gebco_file_error", error=str(e), exc_info=True)
        return {}
