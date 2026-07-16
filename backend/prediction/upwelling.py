import numpy as np
from scipy import ndimage


def detect_thermal_fronts(sst_grid_kelvin):
    sst_clean = np.nan_to_num(sst_grid_kelvin, nan=0.0)
    gx = ndimage.sobel(sst_clean, axis=1)
    gy = ndimage.sobel(sst_clean, axis=0)
    magnitude = np.hypot(gx, gy)
    if magnitude.max() > 0:
        magnitude = magnitude / magnitude.max()
    return magnitude


def build_thermal_front_mask(gradient_magnitude, threshold=0.60):
    return gradient_magnitude >= threshold
