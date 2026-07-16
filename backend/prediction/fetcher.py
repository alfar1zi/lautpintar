import math, json, structlog, asyncio
from pathlib import Path
from datetime import datetime, date, timedelta
import numpy as np

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
    import httpx
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(
            f"{settings.NASA_ERDDAP_BASE_URL}/griddap/jplMURSST41.json"
            f"?analysed_sst[({date_str}T09:00:00Z)]"
            f"[({lat_min}):10:({lat_max})]"
            f"[({lon_min}):10:({lon_max})]")
        r.raise_for_status()
        return _parse_erddap_json(r.json(), "analysed_sst")


async def fetch_chlorophyll_8day(lat_min, lat_max, lon_min, lon_max, date_str):
    import httpx
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(
            f"{settings.NASA_ERDDAP_BASE_URL}/griddap/erdMH1chla8day.json"
            f"?chlorophyll[({date_str}T00:00:00Z)]"
            f"[({lat_min}):1:({lat_max})]"
            f"[({lon_min}):1:({lon_max})]")
        r.raise_for_status()
        return _parse_erddap_json(r.json(), "chlorophyll")


async def fetch_ocean_current(lat_min, lat_max, lon_min, lon_max, date_str):
    import copernicusmarine as cm
    ds = await asyncio.to_thread(cm.open_dataset,
        dataset_id=settings.CMEMS_DATASET_CURRENT,
        variables=["uo", "vo"],
        minimum_longitude=lon_min, maximum_longitude=lon_max,
        minimum_latitude=lat_min, maximum_latitude=lat_max,
        start_datetime=f"{date_str}T00:00:00", end_datetime=f"{date_str}T23:59:59",
        minimum_depth=0, maximum_depth=1,
        username=settings.CMEMS_USERNAME, password=settings.CMEMS_PASSWORD)
    return _xarray_to_dict(ds["uo"]), _xarray_to_dict(ds["vo"])


async def fetch_bmkg_maritime(bmkg_code, lat, lng):
    import httpx
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


def load_gebco_subset(lat_min, lat_max, lon_min, lon_max):
    import xarray as xr
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


async def update_single_region(region_key, region, species):
    from .engine import run_prediction_grid
    from .upwelling import detect_upwelling, detect_thermal_fronts, build_thermal_front_mask
    from .tile_generator import pregenerate_region_tiles
    from backend.cache.redis_client import get_redis, set_json, set_last_update

    lat_min, lat_max, lon_min, lon_max = region["bbox"]
    today = date.today()
    date_str = (today - timedelta(days=2)).isoformat()

    log.info("region_update_start", region=region_key, species=species, date=date_str)

    sst_grid = await fetch_mur_sst(lat_min, lat_max, lon_min, lon_max, date_str)
    chl_grid = await fetch_chlorophyll_8day(lat_min, lat_max, lon_min, lon_max, date_str)
    u_grid, v_grid = {}, {}
    try:
        u_grid, v_grid = await fetch_ocean_current(lat_min, lat_max, lon_min, lon_max, date_str)
    except:
        pass

    center_lat = (lat_min + lat_max) / 2.0
    center_lng = (lon_min + lon_max) / 2.0
    bmkg_data = await fetch_bmkg_maritime(region["bmkg_code"], center_lat, center_lng)
    depth_grid = load_gebco_subset(lat_min, lat_max, lon_min, lon_max)

    wind_data = {coord: bmkg_data for coord in sst_grid.keys()}

    upwelling_set, thermal_set = set(), set()
    if sst_grid:
        lats = sorted(set(k[0] for k in sst_grid.keys()))
        lons = sorted(set(k[1] for k in sst_grid.keys()))
        lat_arr = np.array(lats)
        lon_arr = np.array(lons)
        sst_arr = np.array([[sst_grid.get((la, lo), np.nan) for lo in lons] for la in lats])
        chl_arr = np.array([[chl_grid.get((la, lo), np.nan) for lo in lons] for la in lats])
        u_arr = np.array([[u_grid.get((la, lo), 0.0) for lo in lons] for la in lats])
        v_arr = np.array([[v_grid.get((la, lo), 0.0) for lo in lons] for la in lats])
        upwelling_bool = detect_upwelling(sst_arr, lat_arr, lon_arr, chl_arr, u_arr, v_arr, month=today.month, region_key=region_key)
        thermal_bool = build_thermal_front_mask(detect_thermal_fronts(sst_arr))
        for i, la in enumerate(lats):
            for j, lo in enumerate(lons):
                if upwelling_bool[i, j]:
                    upwelling_set.add((la, lo))
                if thermal_bool[i, j]:
                    thermal_set.add((la, lo))

    cells = run_prediction_grid(sst_grid=sst_grid, chl_grid=chl_grid, current_u_grid=u_grid, current_v_grid=v_grid, wind_data=wind_data, depth_grid=depth_grid, upwelling_mask=upwelling_set, thermal_front_mask=thermal_set, species=species, prediction_date=today)

    redis = await get_redis()
    await pregenerate_region_tiles(cells, region_key, species, zoom_levels=[8, 9, 10], redis_client=redis, ttl_seconds=21600)

    cells_json = []
    for c in cells:
        d = {}
        for k, v in c.__dict__.items():
            if isinstance(v, (bool, int, float, str, type(None))):
                d[k] = v
            elif isinstance(v, dict):
                d[k] = {}
            else:
                d[k] = str(v)
        cells_json.append(d)

    await set_json(f"prediction:{species}:{region_key}", cells_json, ttl=21600)
    await set_last_update(datetime.now().isoformat())

    try:
        redis = await get_redis()
        await redis.setex(f"weather:{region_key}", 21600, json.dumps(bmkg_data))
    except:
        pass

    log.info("region_updated", region=region_key, species=species, cells=len(cells))
    return cells
