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
      UI.currentSpecies = user.default_species || 'tongkol';
      UI.setGreeting(user.full_name);
      UI.show('screen-app');
      updateBottomNav('screen-app');
      if (UI.currentHarbor || UI.currentCoords) UI.loadZone(UI.currentSpecies);
    } catch {
      UI.clearState();
      UI.show('screen-onboarding');
    }
  } else {
    UI.show('screen-onboarding');
    document.getElementById('onboarding-slide-2')?.classList.add('hidden');
  }

  document.getElementById('btn-onboarding-lanjut')?.addEventListener('click', async () => {
    document.getElementById('onboarding-slide-1').classList.add('hidden');
    document.getElementById('onboarding-slide-2').classList.remove('hidden');
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
    try {
      const user = await API.auth.login(email, password);
      UI.setUser(user);
      UI.setGreeting(user.full_name);
      UI.show('screen-app');
      updateBottomNav('screen-app');
      if (UI.currentCoords || UI.currentHarbor) UI.loadZone(UI.currentSpecies);
    } catch (err) {
      errEl.textContent = err.message || 'Login gagal.';
      errEl.classList.remove('hidden');
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
    try {
      const user = await API.auth.register({ email, password, full_name: name, default_species: species });
      UI.setUser(user);
      UI.currentSpecies = species;
      UI.setGreeting(user.full_name);
      UI.show('screen-app');
      updateBottomNav('screen-app');
    } catch (err) {
      errEl.textContent = err.message || 'Daftar gagal.';
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
    UI.show('screen-settings');
    updateBottomNav('screen-settings');
  });
})();

function updateBottomNav(screenId) {
  const nav = document.getElementById('bottom-nav');
  const mainScreens = ['screen-app', 'screen-peta', 'screen-riwayat', 'screen-settings'];
  nav.classList.toggle('hidden', !mainScreens.includes(screenId));
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });
}
