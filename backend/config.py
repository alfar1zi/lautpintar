from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_SECRET_KEY: str

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # NOAA
    NASA_ERDDAP_BASE_URL: str = "https://coastwatch.pfeg.noaa.gov/erddap"

    # CMEMS
    CMEMS_USERNAME: str = ""
    CMEMS_PASSWORD: str = ""
    CMEMS_DATASET_CURRENT: str = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"

    # BMKG Fallback
    BMKG_MARITIME_URL: str = "https://data.bmkg.go.id/DataMKG/MEWS/maritim/"

    TILE_CACHE_TTL: int = 21600
    PREDICTION_CACHE_TTL: int = 21600

    RATE_LIMIT_GLOBAL_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 5
    RATE_LIMIT_PREDICTION_PER_MINUTE: int = 20

    model_config = ConfigDict(env_file="backend/.env", env_file_encoding="utf-8")


settings = Settings()
