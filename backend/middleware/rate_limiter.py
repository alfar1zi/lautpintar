from slowapi import Limiter
from slowapi.util import get_remote_address
from backend.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_GLOBAL_PER_MINUTE}/minute"],
)
