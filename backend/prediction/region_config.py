INDONESIA_REGIONS = {
    "selat_malaka": {
        "name": "Selat Malaka dan Laut Andaman",
        "bbox": (-6.0, 6.0, 95.0, 105.0),
        "bmkg_code": "GI01",
        "peak_upwelling_months": [],
        "dominant_species": ["tongkol", "kembung", "teri"],
    },
    "laut_natuna_karimata": {
        "name": "Laut Natuna dan Selat Karimata",
        "bbox": (-4.0, 6.0, 104.0, 119.0),
        "bmkg_code": "GI02",
        "peak_upwelling_months": [],
        "dominant_species": ["tongkol", "layang", "kembung"],
    },
    "laut_jawa": {
        "name": "Laut Jawa dan Selat Sunda",
        "bbox": (-8.5, -1.0, 104.0, 116.0),
        "bmkg_code": "GI03",
        "peak_upwelling_months": [6, 7, 8, 9],
        "dominant_species": ["tongkol", "layang", "teri", "kembung"],
    },
    "samudra_hindia_selatan": {
        "name": "Samudra Hindia Selatan Jawa-NTT",
        "bbox": (-11.0, -6.0, 104.0, 125.0),
        "bmkg_code": "GI04",
        "peak_upwelling_months": [6, 7, 8, 9, 10],
        "dominant_species": ["cakalang", "tuna_sirip_kuning", "tongkol"],
    },
    "selat_makassar_flores": {
        "name": "Selat Makassar, Laut Flores, dan Selat Bali",
        "bbox": (-9.0, 2.0, 114.0, 122.0),
        "bmkg_code": "GI05",
        "peak_upwelling_months": [7, 8, 9],
        "dominant_species": ["cakalang", "tongkol", "layang", "lemuru"],
    },
    "laut_banda_maluku": {
        "name": "Laut Banda dan Laut Maluku",
        "bbox": (-8.0, -1.0, 122.0, 133.0),
        "bmkg_code": "GI06",
        "peak_upwelling_months": [6, 7, 8, 9, 10],
        "dominant_species": ["cakalang", "tuna_sirip_kuning", "layang"],
    },
    "laut_sulawesi_seram": {
        "name": "Laut Sulawesi dan Laut Seram",
        "bbox": (-4.0, 6.0, 119.0, 130.0),
        "bmkg_code": "GI07",
        "peak_upwelling_months": [],
        "dominant_species": ["cakalang", "tongkol", "teri", "tuna_sirip_kuning"],
    },
    "arafura_papua": {
        "name": "Laut Arafura dan Teluk Cenderawasih",
        "bbox": (-9.0, 6.0, 130.0, 141.0),
        "bmkg_code": "GI08",
        "peak_upwelling_months": [7, 8, 9],
        "dominant_species": ["tuna_sirip_kuning", "cakalang", "layang"],
    },
}


def get_region_for_harbor(harbor_lat: float, harbor_lng: float):
    matches = []
    for region_key, region in INDONESIA_REGIONS.items():
        lat_min, lat_max, lon_min, lon_max = region["bbox"]
        if lat_min <= harbor_lat <= lat_max and lon_min <= harbor_lng <= lon_max:
            area = (lat_max - lat_min) * (lon_max - lon_min)
            matches.append((area, region_key))
    if matches:
        matches.sort(key=lambda x: x[0])
        return matches[0][1]
    return None
