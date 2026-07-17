(async function(){
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

  // Splash minimum 1.5s
  await new Promise(r=>setTimeout(r,1500));
  document.getElementById('screen-splash').classList.remove('screen-active');

  const saved=localStorage.getItem('lp_user_id');
  if(saved){
    try{
      const user=await API.auth.me();
      UI.currentUser=user;
      UI.setGreeting(user.full_name);
      if(user.harbor_id){
        const harbors=await API.harbor.list();
        UI.currentHarbor=harbors.find(h=>h.id===user.harbor_id);
      }
      UI.currentSpecies=user.default_species||'tongkol';
      UI.show('screen-beranda');
      if(UI.currentHarbor)UI.loadZone(UI.currentSpecies);
    }catch(e){
      localStorage.removeItem('lp_user_id');
      UI.show('screen-onboarding');
    }
  }else{
    UI.show('screen-onboarding');
  }

  // === ONBOARDING ===
  document.getElementById('btn-ob-next').addEventListener('click',()=>{
    UI.show('screen-gps');
  });

  // === GPS ===
  document.getElementById('btn-gps-allow').addEventListener('click',()=>{
    if(!navigator.geolocation){UI.show('screen-login');return;}
    navigator.geolocation.getCurrentPosition(
      p=>{UI.currentCoords={lat:p.coords.latitude,lng:p.coords.longitude};UI.show('screen-login');},
      ()=>{UI.show('screen-login');},
      {enableHighAccuracy:true,timeout:15000,maximumAge:60000}
    );
  });
  document.getElementById('btn-gps-skip').addEventListener('click',()=>UI.show('screen-login'));

  // === LOGIN ===
  document.getElementById('btn-show-login-form').addEventListener('click',()=>{
    document.getElementById('login-form-overlay').classList.remove('hidden');
    document.getElementById('login-form-overlay').classList.add('open');
  });
  document.getElementById('login-form-overlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('login-form-overlay')){
      document.getElementById('login-form-overlay').classList.remove('open');
      document.getElementById('login-form-overlay').classList.add('hidden');
    }
  });
  document.getElementById('link-to-register').addEventListener('click',e=>{
    e.preventDefault();
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.remove('hidden');
  });
  document.getElementById('link-to-login-form').addEventListener('click',e=>{
    e.preventDefault();
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
  });

  document.getElementById('form-login').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=document.getElementById('input-email').value.trim();
    const password=document.getElementById('input-password').value;
    const err=document.getElementById('login-error');
    err.classList.add('hidden');
    if(!email||!password){err.textContent='Email dan kata sandi wajib diisi.';err.classList.remove('hidden');return;}
    try{
      const user=await API.auth.login(email,password);
      UI.currentUser=user;
      localStorage.setItem('lp_user_id',user.id);
      UI.setGreeting(user.full_name);
      if(user.harbor_id){
        const harbors=await API.harbor.list();
        UI.currentHarbor=harbors.find(h=>h.id===user.harbor_id);
      }
      UI.currentSpecies=user.default_species||'tongkol';
      document.getElementById('login-form-overlay').classList.remove('open');
      UI.show('screen-beranda');
      UI.updateNav('screen-beranda');
      if(UI.currentHarbor||UI.currentCoords)UI.loadZone(UI.currentSpecies);
    }catch(ex){err.textContent=ex.message||'Login gagal.';err.classList.remove('hidden');}
  });

  document.getElementById('form-register').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=document.getElementById('reg-name').value.trim();
    const email=document.getElementById('reg-email').value.trim();
    const password=document.getElementById('reg-password').value;
    const species=document.getElementById('reg-species').value;
    const err=document.getElementById('register-error');
    err.classList.add('hidden');
    if(!name||!email||!password){err.textContent='Semua field wajib diisi.';err.classList.remove('hidden');return;}
    if(password.length<8){err.textContent='Kata sandi minimal 8 karakter.';err.classList.remove('hidden');return;}
    try{
      const user=await API.auth.register({email,password,full_name:name,default_species:species});
      UI.currentUser=user;
      localStorage.setItem('lp_user_id',user.id);
      UI.setGreeting(user.full_name);
      UI.currentSpecies=species||'tongkol';
      document.getElementById('login-form-overlay').classList.remove('open');
      UI.show('screen-beranda');
      UI.updateNav('screen-beranda');
      if(UI.currentCoords)UI.loadZone(UI.currentSpecies);
    }catch(ex){err.textContent=ex.message||'Pendaftaran gagal.';err.classList.remove('hidden');}
  });

  // === NAVIGATION ===
  document.querySelectorAll('.db-nav').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target=btn.dataset.goto;
      if(target==='screen-riwayat')UI.loadRiwayat();
      if(target==='screen-akun'){
        document.getElementById('ak-nama').textContent=UI.currentUser?.full_name||'Nelayan';
        UI.show('screen-akun');
        UI.updateNav('screen-akun');
        return;
      }
      if(target==='screen-peta'){
        UI.show('screen-peta');
        UI.updateNav('screen-peta');
        initPetaMap();
        return;
      }
      UI.show(target);
      UI.updateNav(target);
    });
  });

  // === DASHBOARD ===
  document.getElementById('btn-db-lihat-cuaca').addEventListener('click',()=>{
    alert('Cuaca detail - data dari Open-Meteo');
  });
  document.getElementById('btn-db-lihat-semua').addEventListener('click',()=>{
    UI.show('screen-peta');
    UI.updateNav('screen-peta');
    initPetaMap();
  });
  document.getElementById('btn-db-cek-detail').addEventListener('click',()=>{
    const rec=UI.getTopRec();
    if(rec)UI.showPetaDetail(rec,rec.distance_km,rec.bearing_degrees,rec.direction);
  });
  document.getElementById('btn-db-navigate').addEventListener('click',()=>{
    const rec=UI.getTopRec();
    if(rec){navigateToZone(rec);}
  });
  document.getElementById('btn-db-pilih-lokasi')?.addEventListener('click',()=>{
    UI.show('screen-akun');
    UI.updateNav('screen-akun');
  });
  document.getElementById('btn-db-aktifkan-gps')?.addEventListener('click',()=>{
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        p=>{UI.currentCoords={lat:p.coords.latitude,lng:p.coords.longitude};UI.loadZone(UI.currentSpecies);},
        ()=>{alert('Izin lokasi ditolak.');}
      );
    }
  });

  // === PETA ===
  document.getElementById('btn-pt-detail').addEventListener('click',()=>{
    const rec=UI.getTopRec();
    if(rec)UI.showPetaDetail(rec,rec.distance_km,rec.bearing_degrees,rec.direction);
  });
  document.getElementById('btn-pt-akun').addEventListener('click',()=>{
    document.getElementById('ak-nama').textContent=UI.currentUser?.full_name||'Nelayan';
    UI.show('screen-akun');
    UI.updateNav('screen-akun');
  });

  // === PETA DETAIL ===
  document.getElementById('btn-pd-back').addEventListener('click',()=>{
    UI.show('screen-peta');
    UI.updateNav('screen-peta');
  });
  document.getElementById('btn-pd-navigate').addEventListener('click',()=>{
    const rec=UI.getTopRec();
    if(rec)navigateToZone(rec);
  });

  // === NAVIGASI ===
  document.getElementById('btn-nv-mulai').addEventListener('click',()=>{
    alert('Navigasi dimulai. Ikuti arah kompas.');
  });

  // === RIWAYAT ===
  document.querySelectorAll('[data-rwf]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-rwf]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      UI.loadRiwayat();
    });
  });

  // === AKUN ===
  document.getElementById('btn-ak-cuaca').addEventListener('click',()=>alert('Cuaca & Kondisi - data dari Open-Meteo'));
  document.getElementById('btn-ak-bantuan')?.addEventListener('click',()=>alert('FAQ: LautPintar menggunakan data satelit NASA, CMEMS, dan GEBCO untuk prediksi zona tangkap.'));
  document.getElementById('btn-ak-logout').addEventListener('click',async()=>{
    try{await API.auth.logout();}catch(e){}
    localStorage.removeItem('lp_user_id');
    UI.currentUser=null;UI.currentHarbor=null;UI.currentCoords=null;
    UI.show('screen-onboarding');
  });

  // === MAPS ===
  let petaMap=null,navMap=null;
  window.initPetaMap=function(){
    const container=document.getElementById('pt-map');
    if(!container)return;
    if(petaMap){petaMap.invalidateSize();return;}
    petaMap=L.map(container,{center:[-2.5,117.5],zoom:5,zoomControl:false,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,minZoom:4,opacity:0.7}).addTo(petaMap);
    L.control.zoom({position:'topleft'}).addTo(petaMap);
    setTimeout(()=>petaMap.invalidateSize(),200);
    const rec=UI.getTopRec();
    if(rec){
      L.marker([rec.zone_lat||rec.lat,rec.zone_lng||rec.lng]).addTo(petaMap).bindPopup('Zona Rekomendasi');
      petaMap.flyTo([rec.zone_lat||rec.lat,rec.zone_lng||rec.lng],8,{duration:1});
    }
  };

  window.navigateToZone=function(rec){
    const lat=rec.zone_lat||rec.lat,lng=rec.zone_lng||rec.lng;
    document.getElementById('nv-jarak').textContent=`${Math.round(rec.distance_km||0)} km`;
    document.getElementById('nv-waktu').textContent=`${Math.max(1,Math.round((rec.distance_km||0)/15))} menit`;
    UI.show('screen-navigasi');
    setTimeout(()=>{
      const container=document.getElementById('nv-map');
      if(!container)return;
      if(navMap){navMap.invalidateSize();return;}
      navMap=L.map(container,{center:[lat,lng],zoom:9,zoomControl:false,attributionControl:false});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,minZoom:4,opacity:0.7}).addTo(navMap);
      L.marker([lat,lng]).addTo(navMap).bindPopup('Zona Rekomendasi');
      setTimeout(()=>navMap.invalidateSize(),200);
    },100);
  };
})();
