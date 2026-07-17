import structlog
from pathlib import Path
import urllib.request
import ssl

log = structlog.get_logger()

GEBCO_URL = "https://www.bodc.ac.uk/data/open_download/gebco/gebco_2024/geotiff/gebco_2024_n50.0_s-60.0_w90.0_e150.0.tif"

def download_gebco():
    path = Path("backend/data/gebco_indonesia.nc")
    if path.exists():
        log.info("gebco_exists", path=str(path))
        return
    log.info("download_gebco_start")
    ctx = ssl._create_unverified_context()
    urllib.request.urlretrieve(GEBCO_URL, path, context=ctx)
    log.info("download_gebco_done")

def main():
    Path("backend/data").mkdir(parents=True, exist_ok=True)
    download_gebco()

if __name__ == "__main__":
    main()
