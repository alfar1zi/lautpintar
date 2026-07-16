from apscheduler.schedulers.asyncio import AsyncIOScheduler
import structlog
import asyncio
from backend.prediction.region_config import INDONESIA_REGIONS

log = structlog.get_logger()


async def run_all_regions_update():
    from backend.prediction.fetcher import update_single_region
    log.info("prediction_update_started", regions=len(INDONESIA_REGIONS))
    success, failed = 0, 0
    for region_key, region in INDONESIA_REGIONS.items():
        for species in region["dominant_species"]:
            try:
                await update_single_region(region_key, region, species)
                success += 1
                await asyncio.sleep(3)
            except Exception as e:
                log.error("region_update_failed", region=region_key, species=species, error=str(e))
                failed += 1
    log.info("prediction_update_complete", success=success, failed=failed)


def setup_scheduler(app):
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(run_all_regions_update, trigger="cron", hour=18, minute=0, id="prediction_night", max_instances=1, misfire_grace_time=600)
    scheduler.add_job(run_all_regions_update, trigger="cron", hour=6, minute=0, id="prediction_morning", max_instances=1, misfire_grace_time=600)
    asyncio.create_task(run_all_regions_update())
    app.state.scheduler = scheduler
    return scheduler
