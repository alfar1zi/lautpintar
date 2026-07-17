import json
from typing import Optional
import redis.asyncio as redis
import structlog
from backend.config import settings

log = structlog.get_logger()
_redis_client: Optional[redis.Redis] = None

async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=False)
    return _redis_client

async def close_redis():
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None

async def get_json(key: str):
    try:
        r = await get_redis()
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception as e:
        log.warning("redis_get_json_error", key=key, error=str(e))
        return None

async def set_json(key: str, data: dict, ttl: int):
    try:
        r = await get_redis()
        val = json.dumps(data).encode("utf-8")
        await r.setex(key, ttl, val)
    except Exception as e:
        log.warning("redis_set_json_error", key=key, error=str(e))

async def get_tile(key: str) -> Optional[bytes]:
    try:
        r = await get_redis()
        return await r.get(key)
    except Exception as e:
        log.warning("redis_tile_error", key=key, error=str(e))
        return None

async def set_last_update(timestamp_iso: str):
    try:
        r = await get_redis()
        await r.setex("prediction:last_update", 86400, timestamp_iso.encode("utf-8"))
    except Exception:
        pass

async def get_last_update() -> str | None:
    try:
        r = await get_redis()
        val = await r.get("prediction:last_update")
        return val.decode("utf-8") if val else None
    except Exception:
        return None
