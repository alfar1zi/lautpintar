const API = {
  BASE: '/api/v1',
  TIMEOUT: 30000,

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('Koneksi terlalu lambat.'), { status: 0 });
      }
      throw Object.assign(new Error('Tidak dapat terhubung ke server.'), { status: 0 });
    }
  },

  async get(path) {
    const res = await this.fetchWithTimeout(`${API.BASE}${path}`, { credentials: 'include' });
    if (!res.ok) throw Object.assign(new Error('Gagal memuat data'), { status: res.status });
    return res.json();
  },

  async post(path, body) {
    const res = await this.fetchWithTimeout(`${API.BASE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error('Gagal mengirim data'), { status: res.status });
    return res.json();
  },

  async put(path, body) {
    const res = await this.fetchWithTimeout(`${API.BASE}${path}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error('Gagal memperbarui data'), { status: res.status });
    return res.json();
  },

  auth: {
    login: (email, password) => API.post('/auth/login', { email, password }),
    register: (data) => API.post('/auth/register', data),
    logout: () => API.post('/auth/logout', {}),
    me: () => API.get('/user/me'),
    update: (data) => API.put('/user/me', data),
  },
  harbor: {
    list: () => API.get('/harbor/list'),
    nearest: (lat, lng) => API.get(`/harbor/nearest?lat=${lat}&lng=${lng}`),
  },
  prediction: {
    zone: (harborId, species, radiusKm = 150, lat = null, lng = null) => {
      if (lat !== null && lng !== null)
        return API.get(`/prediction/zone?lat=${lat}&lng=${lng}&species=${species}&radius_km=${radiusKm}`);
      return API.get(`/prediction/zone?harbor_id=${harborId}&species=${species}&radius_km=${radiusKm}`);
    },
  },
  feedback: {
    trips: (limit = 20, offset = 0) => API.get(`/feedback/trips?limit=${limit}&offset=${offset}`),
  },
};
