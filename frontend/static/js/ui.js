const UI = {
  currentUser: null,
  currentHarbor: null,
  currentCoords: null,
  nearestHarborContext: null,
  currentSpecies: 'tongkol',
  lastZoneData: null,
  detailZoneData: null,
  zoneRequestId: 0,
  currentZonaFilter: 'ALL',
  currentRiwayatData: null,
  lastWeatherData: null,

  show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('screen-active');
  },

  setPetaSheet(state) {
    const ids = { loading: 'peta-sheet-loading', nodata: 'peta-sheet-nodata', recommendation: 'peta-sheet-recommendation', error: 'peta-sheet-error' };
    Object.entries(ids).forEach(([k, id]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', k !== state);
    });
  },

  setGreeting(name) {
    const el = document.querySelector('.bd-greeting');
    if (el) el.textContent = `Hai, ${name || 'Nelayan'}!`;
  },

  getTopRecommendation() {
    return this.lastZoneData?.top_recommendation || null;
  },

  renderBerandaDashboard(data) {
    this.lastZoneData = data;
    const rec = data.top_recommendation;
    if (!rec) return;
    this.updateRekomCard(rec);
  },

  updateRekomCard(rec) {
    document.getElementById('bd-rekom-direction').textContent = `Arah ${rec.direction || '-'}`;
    document.getElementById('bd-rekom-bearing').textContent = `${Math.round(rec.bearing_degrees || 0)}`;
    document.getElementById('bd-rekom-distance').textContent = `${Math.round(rec.distance_km || 0)} km`;
    const cat = rec.category || 'MEDIUM';
    document.getElementById('bd-rekom-category').textContent = { HIGH: 'TINGGI', MEDIUM: 'SEDANG', LOW: 'RENDAH', UNSAFE: 'BAHAYA', AVOID: 'HINDARI' }[cat] || cat;
  },

  async loadZone(species) {
    const nodata = document.getElementById('bd-nodata');
    const sections = document.querySelectorAll('.bd-section');
    if (!this.currentHarbor && !this.currentCoords) {
      if (nodata) nodata.classList.remove('hidden');
      sections.forEach(s => s.classList.add('hidden'));
      this.setPetaSheet('nodata');
      return;
    }
    if (nodata) nodata.classList.add('hidden');
    sections.forEach(s => s.classList.remove('hidden'));

    const requestId = ++this.zoneRequestId;
    this.setPetaSheet('loading');
    try {
      let data;
      if (this.currentCoords) {
        data = await API.prediction.zone(null, this.currentSpecies, 150, this.currentCoords.lat, this.currentCoords.lng);
      } else {
        data = await API.prediction.zone(this.currentHarbor.id, this.currentSpecies);
      }
      if (requestId !== this.zoneRequestId) return;
      this.lastZoneData = data;
      this.renderBerandaDashboard(data);
      this.setPetaSheet('recommendation');
    } catch (err) {
      if (requestId !== this.zoneRequestId) return;
      if (err.status === 401) this.show('screen-onboarding');
      else if (err.status === 503) this.setPetaSheet('nodata');
      else this.setPetaSheet('error');
    }
  },

  showCuacaScreen() {
    const w = this.lastWeatherData;
    const waveVal = document.getElementById('weather-wave')?.textContent || '-';
    document.getElementById('cuaca-wave-big').textContent = waveVal;
    const windEl = document.getElementById('cuaca-wind');
    if (w?.weather_available) {
      windEl.textContent = w.wind_speed_ms != null ? `${Math.round(w.wind_speed_ms * 3.6)} km/h` : '-';
    } else {
      windEl.textContent = '-';
    }
  },

  haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = d => d * Math.PI / 180;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  },

  bearingToText(bearing) {
    const dirs = [{min:0,max:22.5,t:'Utara'},{min:22.5,max:67.5,t:'Timur Laut'},{min:67.5,max:112.5,t:'Timur'},{min:112.5,max:157.5,t:'Tenggara'},{min:157.5,max:202.5,t:'Selatan'},{min:202.5,max:247.5,t:'Barat Daya'},{min:247.5,max:292.5,t:'Barat'},{min:292.5,max:337.5,t:'Barat Laut'},{min:337.5,max:360,t:'Utara'}];
    for (const d of dirs) { if (bearing >= d.min && bearing < d.max) return d.t; }
    return 'Utara';
  },

  showDetailLokasi(zone, distance, bearing, directionText) {
    this.detailZoneData = { ...zone, distance_km: distance, bearing_degrees: bearing, direction: directionText };
    document.getElementById('dl-coord-text').textContent = `${zone.lat}, ${zone.lng}`;
    document.getElementById('dl-sst').textContent = zone.sst_celsius != null ? `${zone.sst_celsius.toFixed(1)} C` : '-';
    const totalKm = Math.round(distance * 2);
    document.getElementById('dl-fuel-total').textContent = `${Math.round(totalKm * 0.5)} L`;
    this.show('screen-detail-lokasi');
  },

  navigateToZoneOnMap(zone, distance, bearing, directionText) {
    const rec = { zone_lat: zone.lat, zone_lng: zone.lng, category: zone.category, fps: zone.fps, distance_km: distance, bearing_degrees: bearing, direction: directionText };
    this.lastZoneData = { ...this.lastZoneData, top_recommendation: rec };
    this.show('screen-app');
    if (typeof MAP !== 'undefined') MAP.flyToHarbor(zone.lat, zone.lng);
  },

  setUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('lp_user_id', user.id);
      localStorage.setItem('lp_harbor_id', user.harbor_id || '');
      localStorage.setItem('lp_species', user.default_species || 'tongkol');
    }
  },

  getSavedState() {
    return { userId: localStorage.getItem('lp_user_id'), harborId: localStorage.getItem('lp_harbor_id'), species: localStorage.getItem('lp_species') || 'tongkol' };
  },

  clearState() {
    localStorage.removeItem('lp_user_id');
    localStorage.removeItem('lp_harbor_id');
    localStorage.removeItem('lp_species');
    this.currentUser = null;
    this.currentHarbor = null;
  },

  async loadRiwayat() {
    const emptyEl = document.getElementById('riwayat-empty');
    const listEl = document.getElementById('riwayat-list');
    try {
      const data = await API.feedback.trips(100, 0);
      if (!data.trips || data.trips.length === 0) { emptyEl.classList.remove('hidden'); return; }
      emptyEl.classList.add('hidden');
      document.getElementById('riwayat-content').classList.remove('hidden');
      this.currentRiwayatData = data.trips;
      listEl.innerHTML = data.trips.map(r => `<div class="riwayat-card"><span>${r.species}</span><span>${r.catch_kg || '-'}</span></div>`).join('');
    } catch { emptyEl.classList.remove('hidden'); }
  },
};
