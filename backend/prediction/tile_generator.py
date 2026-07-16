import math, io
import numpy as np
from PIL import Image
from collections import defaultdict

RGBA_MAP = {
    "HIGH": (50, 200, 80, 200),
    "MEDIUM": (255, 220, 50, 160),
    "LOW": (100, 180, 255, 100),
    "AVOID": (0, 0, 0, 0),
    "UNSAFE": (220, 50, 50, 200),
}


def latlon_to_tile(lat, lng, zoom):
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def latlon_to_pixel_in_tile(lat, lng, tile_x, tile_y, zoom, tile_size=256):
    n = 2 ** zoom
    tile_lon_min = tile_x / n * 360.0 - 180.0
    tile_lon_max = (tile_x + 1) / n * 360.0 - 180.0
    lat_rad_max = math.atan(math.sinh(math.pi * (1 - 2 * tile_y / n)))
    lat_rad_min = math.atan(math.sinh(math.pi * (1 - 2 * (tile_y + 1) / n)))
    tile_lat_max = math.degrees(lat_rad_max)
    tile_lat_min = math.degrees(lat_rad_min)
    if (tile_lon_max - tile_lon_min) == 0 or (tile_lat_max - tile_lat_min) == 0:
        return -1, -1
    px = int((lng - tile_lon_min) / (tile_lon_max - tile_lon_min) * tile_size)
    py = int((tile_lat_max - lat) / (tile_lat_max - tile_lat_min) * tile_size)
    if px < 0 or px >= tile_size or py < 0 or py >= tile_size:
        return -1, -1
    return px, py


def generate_tile_png(cells, tile_x, tile_y, zoom):
    tile_size = 256
    img = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
    pixels = img.load()
    for cell in cells:
        px, py = latlon_to_pixel_in_tile(cell["lat"], cell["lng"], tile_x, tile_y, zoom, tile_size)
        if 0 <= px < tile_size and 0 <= py < tile_size:
            rgba = RGBA_MAP.get(cell["category"], (0, 0, 0, 0))
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    nx, ny = px + dx, py + dy
                    if 0 <= nx < tile_size and 0 <= ny < tile_size:
                        pixels[nx, ny] = rgba
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def pregenerate_region_tiles(cells, region_key, species, zoom_levels, redis_client, ttl_seconds=21600):
    for zoom in zoom_levels:
        tiles = defaultdict(list)
        for cell in cells:
            tx, ty = latlon_to_tile(cell["lat"], cell["lng"], zoom)
            tiles[(tx, ty)].append(cell)
        for (tx, ty), tile_cells in tiles.items():
            tile_png = generate_tile_png(tile_cells, tx, ty, zoom)
            cache_key = f"tile:{species}:{zoom}:{tx}:{ty}"
            await redis_client.setex(cache_key, ttl_seconds, tile_png)
