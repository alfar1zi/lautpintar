import pytest
from backend.prediction.fetcher import fetch_bmkg_maritime

@pytest.mark.asyncio
async def test_fetch_bmkg_maritime_success():
    res = await fetch_bmkg_maritime("dummy", -6.0, 106.8)
    assert "wind_speed_ms" in res
    assert "wave_height_m" in res

@pytest.mark.asyncio
async def test_fetch_bmkg_maritime_failure():
    res = await fetch_bmkg_maritime("dummy", 999.0, 999.0)
    assert res["wind_speed_ms"] == 0.0
    assert res["wave_height_m"] == 0.0
