const MAP = {
  instance: null,
  tileLayer: null,
  predictionLayer: null,
  currentSpecies: 'tongkol',
  zoneMarkers: [],
  containerId: 'map',

  init(containerId) {
    if (this.instance) {
      this.instance.invalidateSize();
      return;
    }
    this.containerId = containerId || 'map';
    this.instance = L.map(this.containerId, {
      center: [-2.5, 117.5], zoom: 5,
      zoomControl: false, attributionControl: false,
    });

    this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12, minZoom: 4, subdomains: 'abc', opacity: 0.7,
    }).addTo(this.instance);

    L.control.zoom({ position: 'topleft' }).addTo(this.instance);
    this.setPredictionLayer(this.currentSpecies);
  },

  setPredictionLayer(species) {
    this.currentSpecies = species;
    if (this.predictionLayer) this.instance.removeLayer(this.predictionLayer);
    this.predictionLayer = L.tileLayer(`/api/v1/prediction/tile/{z}/{x}/{y}.png?species=${species}`, {
      opacity: 0.75, maxZoom: 12, minZoom: 7, tileSize: 256, updateWhenIdle: true,
    }).addTo(this.instance);
  },

  toLatLng(lat, lng) {
    const point = [Number(lat), Number(lng)];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    return point;
  },

  refreshSize() { if (this.instance) this.instance.invalidateSize(false); },

  flyToHarbor(lat, lng) {
    const point = this.toLatLng(lat, lng);
    if (!point) return;
    requestAnimationFrame(() => {
      this.refreshSize();
      this.instance.flyTo(point, 8, { animate: true, duration: 1 });
    });
  },

  addRecommendationMarker(lat, lng, category) {
    const point = this.toLatLng(lat, lng);
    if (!point) return;
    this.zoneMarkers.forEach(m => this.instance.removeLayer(m));
    this.zoneMarkers = [];

    const colors = { HIGH: '#005D32', MEDIUM: '#7F5300', LOW: '#005478', UNSAFE: '#B71824' };
    const color = colors[category] || colors.MEDIUM;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid #011D2C;"></div>`,
      iconSize: [24, 24], iconAnchor: [12, 12],
    });

    const marker = L.marker(point, { icon }).addTo(this.instance);
    this.zoneMarkers.push(marker);

    requestAnimationFrame(() => {
      this.instance.flyTo(point, 9, { animate: true, duration: 1.2 });
    });
  },
};
