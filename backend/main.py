from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.config import settings
from backend.db.database import init_db
from backend.middleware.rate_limiter import limiter
from backend.middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    from backend.cache.redis_client import close_redis
    await close_redis()


app = FastAPI(title="LautPintar API", version="1.0.0", lifespan=lifespan,
              default_response_class=JSONResponse)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

if settings.APP_ENV == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],
        allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    )

from backend.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

from backend.prediction.router import router as prediction_router
app.include_router(prediction_router, prefix="/api/v1/prediction", tags=["prediction"])

from backend.user.router import router as user_router
app.include_router(user_router, prefix="/api/v1/user", tags=["user"])

from backend.feedback.router import router as feedback_router
app.include_router(feedback_router, prefix="/api/v1/feedback", tags=["feedback"])

from backend.harbor.router import router as harbor_router
app.include_router(harbor_router, prefix="/api/v1/harbor", tags=["harbor"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
