# LautPintar

> Fish finding for Indonesian fishermen. Save fuel. Catch more.

## Inspiration

Traditional fishermen in Indonesia spend up to 70% of their money on fuel. They often sail without knowing where the fish are. This is a gamble. We wanted to stop this gamble by building a simple, offline map app that shows where the fish are using real satellite data.

## What it does

LautPintar is a PWA map app. It downloads ocean data from NASA and Copernicus, calculates a Fishing Potential Score (FPS) based on temperature and plankton, and shows the best fishing zones on a map. The app works 100% offline at sea.

## How we built it

Backend: FastAPI, PostgreSQL, Redis, APScheduler.
Prediction engine: Python (NumPy, SciPy) + NASA MUR SST + MODIS Chlorophyll + CMEMS currents.
Frontend: Leaflet.js, vanilla JS.
Offline: PWA Service Worker caches map tiles on the phone.

## Challenges

Internet at sea is bad. Fishermen use cheap phones (2GB RAM). Our first version crashed because rendering coordinates on the phone was too heavy. We moved all calculations to the server. The phone only loads small PNG tiles now.

## Features

- 7 pelagic fish species: Tongkol, Cakalang, Tuna Sirip Kuning, Kembung, Teri, Layang, Lemuru
- 8 Indonesian marine regions
- Fishing Potential Score (FPS) based on SST, chlorophyll, currents, upwelling, thermal fronts
- Safety warnings for high waves and strong winds
- Fishing ban zones from KKP regulations
- Bait and gear recommendations
- Fuel estimation
- Offline-first PWA

## Built With

- **Backend**: FastAPI, PostgreSQL 16, Redis 7, APScheduler
- **Prediction Engine**: Python, NumPy, SciPy, Xarray, NetCDF4, Pillow
- **Frontend**: Leaflet.js, HTML5, CSS3, Vanilla JavaScript
- **Data Sources**: NASA MUR SST, NASA MODIS Chlorophyll, Copernicus Marine (CMEMS), GEBCO Bathymetry, Open-Meteo
- **Deployment**: Docker, Docker Compose
- **Auth**: JWT httpOnly cookies, bcrypt

## Try It

[Live Demo](https://lautpintar.live) | [GitHub](https://github.com/alfar1zi/lautpintar)

## Team

- Fadhlurrahman Alfarisi
- Alsimly
- Regon Chefendi
