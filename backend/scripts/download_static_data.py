import structlog
from pathlib import Path
import urllib.request
import ssl

log = structlog.get_logger()

# GEBCO GeoTIFF download disabled: saved as .tif but pipeline expects .nc.
# Re-enable after aligning format or adding a conversion step.
# GEBCO_URL = "https://www.bodc.ac.uk/data/open_download/gebco/gebco_2024/geotiff/gebco_2024_n50.0_s-60.0_w90.0_e150.0.tif"

def download_gebco():
    log.info("gebco_download_skipped", reason="GEBCO data must be downloaded manually. Place gebco_indonesia.nc in backend/data/")

def main():
    Path("backend/data").mkdir(parents=True, exist_ok=True)
    download_gebco()

if __name__ == "__main__":
    main()
