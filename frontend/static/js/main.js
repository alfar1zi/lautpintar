(async function initApp() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  window.addEventListener('online', () => {
    document.getElementById('offline-banner')?.classList.add('hidden');
    if (UI.currentHarbor || UI.currentCoords) UI.loadZone(UI.currentSpecies);
  });
  window.addEventListener('offline', () => {
    document.getElementById('offline-banner')?.classList.remove('hidden');
  });
  if (!navigator.onLine) {
    document.getElementById('offline-banner')?.classList.remove('hidden');
  }

  const saved = UI.getSavedState();
  setTimeout(() => {
    document.getElementById('screen-loading').classList.remove('screen-active');
  }, 800);

  if (saved.userId) {
    try {
      const user = await API.auth.me();
      UI.setUser(user);
      const harborId = user.harbor_id || saved.harborId;
      if (harborId) {
        const harbors = await API.harbor.list();
        UI.currentHarbor = harbors.find(h => h.id === harborId);
      }
      UI.currentSpecies = user.default_species || saved.species || 'tongkol';
      UI.setGreeting(user.full_name);
      UI.show('screen-app');
      updateBottomNav('screen-app');
      if (UI.currentHarbor || UI.currentCoords) UI.loadZone(UI.currentSpecies);
      UI.populateHarborDropdown('settings-harbor');
    } catch {
      UI.clearState();
      UI.show('screen-onboarding');
    }
  } else {
    UI.show('screen-onboarding');
    document.getElementById('onboarding-slide-2')?.classList.add('hidden');
  }
  UI.populateHarborDropdown('settings-harbor');

  document.getElementById('btn-onboarding-lanjut')?.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      document.getElementById('onboarding-slide-1').classList.add('hidden');
      document.getElementById('onboarding-slide-2').classList.remove('hidden');
      return;
    }
    const loader = document.getElementById('onboarding-slide-loader');
    if (loader) loader.classList.remove('hidden');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        UI.currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        try {
          const nearest = await API.harbor.nearest(UI.currentCoords.lat, UI.currentCoords.lng);
          UI.nearestHarborContext = `${nearest.distance_km}km dari ${nearest.name}`;
        } catch {}
        if (loader) loader.classList.add('hidden');
        document.getElementById('onboarding-slide-1').classList.add('hidden');
        document.getElementById('onboarding-slide-2').classList.remove('hidden');
      },
      () => {
        if (loader) loader.classList.add('hidden');
        document.getElementById('onboarding-slide-1').classList.add('hidden');
        document.getElementById('onboarding-slide-2').classList.remove('hidden');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });

  document.getElementById('link-skip-gps')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('onboarding-slide-1').classList.add('hidden');
    document.getElementById('onboarding-slide-2').classList.remove('hidden');
  });

  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-email').value.trim();
    const password = document.getElementById('input-password').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    if (!email || !password) { errEl.textContent = 'Email dan password wajib diisi.'; errEl.classList.remove('hidden'); return; }
    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    try {
      const user = await API.auth.login(email, password);
      UI.setUser(user);
      if (user.harbor_id) {
        const harbors = await API.harbor.list();
        UI.currentHarbor = harbors.find(h => h.id === user.harbor_id);
      }
      UI.currentSpecies = user.default_species || 'tongkol';
      UI.setGreeting(user.full_name);
      UI.show('screen-app');
      updateBottomNav('screen-app');
      if (UI.currentCoords || UI.currentHarbor) UI.loadZone(UI.currentSpecies);
    } catch (err) {
      errEl.textContent = err.message || 'Email atau password salah.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
    }
  });

  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const species = document.getElementById('reg-species').value;
    const errEl = document.getElementById('register-error');
    errEl.classList.add('hidden');
    if (!name || !email || !password) { errEl.textContent = 'Semua field wajib diisi.'; errEl.classList.remove('hidden'); return; }
    try {
      const user = await API.auth.register({ email, password, full_name: name, default_species: species });
      UI.setUser(user);
      UI.currentSpecies = species || 'tongkol';
      UI.setGreeting(user.full_name);
      UI.show('screen-app');
      updateBottomNav('screen-app');
    } catch (err) {
      errEl.textContent = err.message || 'Pendaftaran gagal.';
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('link-to-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.remove('hidden');
  });
  document.getElementById('link-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
  });

  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.screen;
      if (target === 'screen-peta') {
        MAP.init('map-peta');
        UI.show('screen-peta');
        updateBottomNav('screen-peta');
        MAP.refreshSize();
        return;
      }
      if (target === 'screen-riwayat') UI.loadRiwayat();
      if (target === 'screen-settings') populateSettings();
      UI.show(target);
      updateBottomNav(target);
    });
  });

  document.getElementById('btn-peta-gps')?.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        UI.currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        UI.currentHarbor = null;
        MAP.flyToHarbor(UI.currentCoords.lat, UI.currentCoords.lng);
        await UI.loadZone(UI.currentSpecies);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

  document.getElementById('btn-bd-aktifkan-gps')?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          UI.currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          UI.currentHarbor = null;
          await UI.loadZone(UI.currentSpecies);
        },
        () => { alert('Izin lokasi ditolak.'); }
      );
    }
  });

  document.getElementById('btn-bd-pilih-pelabuhan')?.addEventListener('click', () => {
    populateSettings();
    UI.show('screen-settings');
    updateBottomNav('screen-settings');
  });

  document.getElementById('btn-bd-navigate')?.addEventListener('click', () => {
    const zone = UI.getTopRecommendation();
    if (zone) UI.navigateToZoneOnMap(zone, zone.distance_km || 0, zone.bearing_degrees || 0, zone.direction || 'Utara');
  });

  document.getElementById('btn-bd-cek-detail')?.addEventListener('click', () => {
    const zone = UI.getTopRecommendation();
    if (zone) UI.showDetailLokasi(zone, zone.distance_km || 0, zone.bearing_degrees || 0, zone.direction || 'Utara');
  });

  document.getElementById('btn-back-settings')?.addEventListener('click', () => {
    UI.show('screen-app');
    updateBottomNav('screen-app');
  });

  document.getElementById('btn-back-peta')?.addEventListener('click', () => {
    UI.show('screen-app');
    updateBottomNav('screen-app');
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await API.auth.logout(); } catch {}
    UI.clearState();
    UI.show('screen-onboarding');
    updateBottomNav('screen-onboarding');
  });

  document.querySelectorAll('.species-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const species = btn.dataset.species;
      document.querySelectorAll('.species-btn').forEach(b => { b.classList.toggle('active', b.dataset.species === species); });
      UI.currentSpecies = species;
      localStorage.setItem('lp_species', species);
      if (UI.currentHarbor || UI.currentCoords) UI.loadZone(species);
    });
  });

  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-settings');
    btn.disabled = true;
    try {
      const data = {};
      const name = document.getElementById('settings-name').value.trim();
      if (name) data.full_name = name;
      const harborId = document.getElementById('settings-harbor').value;
      if (harborId) data.harbor_id = harborId;
      data.default_species = document.getElementById('settings-species').value;
      const user = await API.auth.update(data);
      UI.setUser(user);
      btn.disabled = false;
      alert('Profil tersimpan.');
    } catch (err) {
      btn.disabled = false;
      alert(err.message || 'Gagal menyimpan.');
    }
  });

  document.getElementById('btn-menu-cuaca')?.addEventListener('click', () => {
    UI.showCuacaScreen();
    UI.show('screen-cuaca');
  });

  document.getElementById('btn-menu-bantuan')?.addEventListener('click', () => {
    UI.show('screen-bantuan');
  });

  document.getElementById('btn-back-cuaca')?.addEventListener('click', () => {
    UI.show('screen-app');
    updateBottomNav('screen-app');
  });

  document.getElementById('btn-back-bantuan')?.addEventListener('click', () => {
    UI.show('screen-app');
    updateBottomNav('screen-app');
  });

  document.getElementById('btn-back-notifikasi')?.addEventListener('click', () => {
    UI.show('screen-app');
    updateBottomNav('screen-app');
  });

  document.getElementById('btn-riwayat-beranda')?.addEventListener('click', () => {
    UI.show('screen-app');
    updateBottomNav('screen-app');
  });

  document.getElementById('btn-navigate-detail')?.addEventListener('click', () => {
    const zone = UI.detailZoneData;
    if (zone) UI.navigateToZoneOnMap(zone, zone.distance_km, zone.bearing_degrees, zone.direction);
  });

  document.getElementById('btn-back-detail')?.addEventListener('click', () => {
    UI.show('screen-peta');
    updateBottomNav('screen-peta');
  });

  document.getElementById('btn-peta-retry')?.addEventListener('click', () => {
    if ((UI.currentHarbor || UI.currentCoords) && UI.currentSpecies) UI.loadZone(UI.currentSpecies);
  });

  document.getElementById('btn-peta-refresh')?.addEventListener('click', () => {
    if ((UI.currentHarbor || UI.currentCoords) && UI.currentSpecies) UI.loadZone(UI.currentSpecies);
  });

  document.getElementById('btn-bd-lihat-semua')?.addEventListener('click', () => {
    MAP.init('map-peta');
    UI.show('screen-peta');
    updateBottomNav('screen-peta');
  });

  document.getElementById('btn-bd-weather-detail')?.addEventListener('click', () => {
    UI.showCuacaScreen();
    UI.show('screen-cuaca');
  });
})();

function updateBottomNav(screenId) {
  const nav = document.getElementById('bottom-nav');
  const mainScreens = ['screen-app', 'screen-peta', 'screen-riwayat', 'screen-settings'];
  nav.classList.toggle('hidden', !mainScreens.includes(screenId));
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    const isActive = item.dataset.screen === screenId;
    item.classList.toggle('active', isActive);
  });
}

async function populateSettings() {
  document.getElementById('settings-name').value = UI.currentUser?.full_name || '';
  const harborSelect = document.getElementById('settings-harbor');
  try {
    const harbors = await API.harbor.list();
    harborSelect.innerHTML = '<option value="">-- Pilih Pelabuhan --</option>';
    harbors.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `${h.name} (${h.province})`;
      if (h.id === UI.currentUser?.harbor_id) opt.selected = true;
      harborSelect.appendChild(opt);
    });
  } catch { harborSelect.innerHTML = '<option value="">Gagal memuat</option>'; }
}

UI.populateHarborDropdown = async function(selectId) {
  const select = document.getElementById(selectId);
  try {
    const harbors = await API.harbor.list();
    select.innerHTML = '<option value="">-- Pilih pelabuhan --</option>';
    harbors.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `${h.name} (${h.province})`;
      select.appendChild(opt);
    });
  } catch { select.innerHTML = '<option value="">Gagal memuat</option>'; }
};
