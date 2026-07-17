const UI = {
  currentUser: null,
  currentHarbor: null,
  currentCoords: null,
  currentSpecies: 'tongkol',
  lastZoneData: null,
  zoneRequestId: 0,

  show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('screen-active');
  },

  setSheetState(state) {
    this.setPetaSheet(state);
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
    const cat = rec.category || 'MEDIUM';
    document.getElementById('bd-rekom-direction').textContent = `Arah ${rec.direction || '-'}`;
    document.getElementById('bd-rekom-bearing').textContent = `${Math.round(rec.bearing_degrees || 0)}`;
    document.getElementById('bd-rekom-distance').textContent = `${Math.round(rec.distance_km || 0)} km`;
    document.getElementById('bd-rekom-category').textContent = { HIGH: 'TINGGI', MEDIUM: 'SEDANG', LOW: 'RENDAH' }[cat] || cat;
  },

  async loadZone(species) {
    const requestId = ++this.zoneRequestId;
    this.setPetaSheet('loading');
    try {
      let data;
      if (this.currentCoords) {
        data = await API.prediction.zone(null, species, 150, this.currentCoords.lat, this.currentCoords.lng);
      } else {
        data = await API.prediction.zone(this.currentHarbor.id, species);
      }
      if (requestId !== this.zoneRequestId) return;
      this.lastZoneData = data;
      this.renderBerandaDashboard(data);
      this.setPetaSheet('recommendation');
    } catch (err) {
      if (requestId !== this.zoneRequestId) return;
      this.setPetaSheet('error');
    }
  },

  setUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('lp_user_id', user.id);
      localStorage.setItem('lp_harbor_id', user.harbor_id || '');
    }
  },

  getSavedState() {
    return { userId: localStorage.getItem('lp_user_id'), harborId: localStorage.getItem('lp_harbor_id') };
  },

  clearState() {
    localStorage.removeItem('lp_user_id');
    localStorage.removeItem('lp_harbor_id');
    this.currentUser = null;
    this.currentHarbor = null;
  },
};
