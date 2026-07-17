'use strict';
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
      UI.show('screen-login');
    }
  }else{
    UI.show('screen-onboarding');
  }

  // === ONBOARDING ===
  document.getElementById('btn-ob-next').addEventListener('click',()=>{
    UI.show('screen-gps');
  });

  let gpsResolved=!!UI.currentCoords;

  // === GPS ===
  document.getElementById('btn-gps-allow').addEventListener('click',()=>{
    if(!navigator.geolocation){UI.show('screen-login');return;}
    navigator.geolocation.getCurrentPosition(
      p=>{UI.currentCoords={lat:p.coords.latitude,lng:p.coords.longitude};gpsResolved=true;UI.show('screen-login');},
      ()=>{UI.show('screen-login');},
      {enableHighAccuracy:true,timeout:15000,maximumAge:120000}
    );
  });
  document.getElementById('btn-gps-skip').addEventListener('click',()=>UI.show('screen-login'));

  // === LOGIN ===
  document.getElementById('btn-show-login-form').addEventListener('click',()=>{
    document.getElementById('login-form-overlay').classList.add('open');
  });
  document.getElementById('login-form-overlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('login-form-overlay')){
      document.getElementById('login-form-overlay').classList.remove('open');
    }
  });
  document.getElementById('link-to-register').addEventListener('click',e=>{
    e.preventDefault();
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.remove('hidden');
    document.getElementById('login-form-overlay').classList.add('open');
  });
  document.getElementById('link-to-login-form').addEventListener('click',e=>{
    e.preventDefault();
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
  });

  document.getElementById('form-login').addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=e.target.querySelector('.form-submit');if(btn)btn.disabled=true;
    const email=document.getElementById('input-email').value.trim();
    const password=document.getElementById('input-password').value;
    const err=document.getElementById('login-error');
    err.classList.add('hidden');
    if(!email||!password){err.textContent='Email dan kata sandi wajib diisi.';err.classList.remove('hidden');if(btn)btn.disabled=false;return;}
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
    }catch(ex){err.textContent=ex.message||'Masuk gagal.';err.classList.remove('hidden');}
    if(btn)btn.disabled=false;
  });

  document.getElementById('form-register').addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=e.target.querySelector('.form-submit');if(btn)btn.disabled=true;
    const name=document.getElementById('reg-name').value.trim();
    const email=document.getElementById('reg-email').value.trim();
    const password=document.getElementById('reg-password').value;
    const err=document.getElementById('register-error');
    err.classList.add('hidden');
    if(!name||!email||!password){err.textContent='Semua kolom wajib diisi.';err.classList.remove('hidden');if(btn)btn.disabled=false;return;}
    if(password.length<8){err.textContent='Kata sandi minimal 8 karakter.';err.classList.remove('hidden');if(btn)btn.disabled=false;return;}
    try{
      const user=await API.auth.register({email,password,full_name:name,default_species:'tongkol'});
      UI.currentUser=user;
      localStorage.setItem('lp_user_id',user.id);
      UI.setGreeting(user.full_name);
      UI.currentSpecies='tongkol';
      document.getElementById('login-form-overlay').classList.remove('open');
      UI.show('screen-beranda');
      UI.updateNav('screen-beranda');
      if(UI.currentCoords)UI.loadZone(UI.currentSpecies);
    }catch(ex){err.textContent=ex.message||'Daftar gagal.';err.classList.remove('hidden');}
    if(btn)btn.disabled=false;
  });

  // === NAVIGATION - bottom nav stays on peta too
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
      if(target==='screen-beranda'){
        UI.show('screen-beranda');
        UI.updateNav('screen-beranda');
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
    if(gpsResolved&&UI.currentCoords){UI.loadZone(UI.currentSpecies);return;}
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        p=>{UI.currentCoords={lat:p.coords.latitude,lng:p.coords.longitude};gpsResolved=true;UI.loadZone(UI.currentSpecies);},
        ()=>{alert('Izin lokasi ditolak.');}
      );
    }
  });
  document.getElementById('btn-db-notif')?.addEventListener('click',()=>{
    alert('Tidak ada notifikasi baru.');
  });
  document.getElementById('btn-db-akun')?.addEventListener('click',()=>{
    document.getElementById('ak-nama').textContent=UI.currentUser?.full_name||'Nelayan';
    UI.show('screen-akun');
    UI.updateNav('screen-akun');
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
  document.getElementById('btn-pt-gps')?.addEventListener('click',()=>{
    if(gpsResolved&&UI.currentCoords){
      if(initPetaMap.blueDot)initPetaMap.blueDot.setLatLng([UI.currentCoords.lat,UI.currentCoords.lng]);
      else initPetaMap.blueDot=L.circleMarker([UI.currentCoords.lat,UI.currentCoords.lng],{radius:8,color:'#1976D2',fillColor:'#1976D2',fillOpacity:0.8}).addTo(petaMap);
      petaMap.flyTo([UI.currentCoords.lat,UI.currentCoords.lng],8,{duration:1});
      return;
    }
    if(!navigator.geolocation){alert('GPS tidak tersedia');return;}
    navigator.geolocation.getCurrentPosition(
      p=>{
        const lat=p.coords.latitude,lng=p.coords.longitude;
        UI.currentCoords={lat,lng};gpsResolved=true;
        if(initPetaMap.blueDot)initPetaMap.blueDot.setLatLng([lat,lng]);
        else initPetaMap.blueDot=L.circleMarker([lat,lng],{radius:8,color:'#1976D2',fillColor:'#1976D2',fillOpacity:0.8}).addTo(petaMap);
        petaMap.flyTo([lat,lng],8,{duration:1});
      },
      ()=>{alert('Izin lokasi ditolak.');},
      {enableHighAccuracy:true,timeout:10000,maximumAge:120000}
    );
  });
  document.getElementById('btn-pt-navigate')?.addEventListener('click',()=>{
    const rec=UI.getTopRec();
    if(rec)navigateToZone(rec);
  });
  document.getElementById('btn-pt-download')?.addEventListener('click',()=>{
    if('serviceWorker'in navigator&&navigator.serviceWorker.controller){
      caches.open('lautpintar-tiles-v3').then(cache=>{
        const btns=document.getElementById('btn-pt-download');
        btns.innerHTML='<span style="font-size:16px;">...</span>';
        let ok=0;
        for(let z=8;z<=10;z++){
          for(let x=Math.floor(Math.pow(2,z-2));x<Math.floor(Math.pow(2,z-1));x+=2){
            for(let y=0;y<Math.floor(Math.pow(2,z-2));y+=2){
              const url=`/api/v1/prediction/tile/${z}/${x}/${y}.png?species=${UI.currentSpecies}`;
              cache.add(url).then(()=>ok++).catch(()=>{});
            }
          }
        }
        setTimeout(()=>{if(ok>0){btns.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';alert('Peta siap offline.');}else btns.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';},500);
      });
    }else{alert('Buka halaman ini lewat browser, bukan file lokal.');}
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
  document.getElementById('btn-nv-back')?.addEventListener('click',()=>{UI.show('screen-peta');UI.updateNav('screen-peta');});
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
  document.getElementById('btn-ak-profil')?.addEventListener('click',()=>alert('Pengaturan profil'));
  document.getElementById('btn-ak-notifikasi')?.addEventListener('click',()=>alert('Pengaturan notifikasi'));
  document.getElementById('btn-ak-bahasa')?.addEventListener('click',()=>alert('Bahasa: Bahasa Indonesia'));
  document.getElementById('btn-ak-tentang')?.addEventListener('click',()=>alert('LautPintar v3.5.0 - Prediksi zona tangkap ikan'));
  document.getElementById('btn-ak-logout').addEventListener('click',async()=>{
    try{await API.auth.logout();}catch(e){}
    localStorage.removeItem('lp_user_id');
    UI.currentUser=null;UI.currentHarbor=null;UI.currentCoords=null;
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-register').classList.add('hidden');
    UI.show('screen-onboarding');
  });

  // === MAPS ===
  let petaMap=null,navMap=null;
  window.initPetaMap=function(){
    const container=document.getElementById('pt-map');
    if(!container)return;
    if(petaMap){petaMap.invalidateSize();}
    else{
      petaMap=L.map(container,{center:[-2.5,117.5],zoom:5,zoomControl:false,attributionControl:false});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,minZoom:4,opacity:0.7}).addTo(petaMap);
      L.control.zoom({position:'topleft'}).addTo(petaMap);
      if(UI.currentCoords){
        window.initPetaMap.blueDot=L.circleMarker([UI.currentCoords.lat,UI.currentCoords.lng],{radius:8,color:'#1976D2',fillColor:'#1976D2',fillOpacity:0.8}).addTo(petaMap);
      }
      setTimeout(()=>petaMap.invalidateSize(),200);
    }
    const rec=UI.getTopRec();
    if(rec){
      document.getElementById('pt-dist').textContent=Math.round(rec.distance_km||0);
      document.getElementById('pt-time').textContent=Math.max(1,Math.round((rec.distance_km||0)/15));
      document.getElementById('pt-coord').textContent=`${rec.zone_lat?.toFixed(3)||rec.lat?.toFixed(3)||'-'}, ${rec.zone_lng?.toFixed(3)||rec.lng?.toFixed(3)||'-'}`;
    }
  };

  window.navigateToZone=function(rec){
    const lat=rec.zone_lat||rec.lat,lng=rec.zone_lng||rec.lng;
    document.getElementById('nv-jarak').textContent=`${Math.round(rec.distance_km||0)} km`;
    document.getElementById('nv-waktu').textContent=`${Math.max(1,Math.round((rec.distance_km||0)/15))} menit`;
    document.getElementById('nv-depart-name').textContent=UI.currentHarbor?.name||'Lokasi Saya';
    UI.show('screen-navigasi');
    setTimeout(()=>{
      const container=document.getElementById('nv-map');
      if(!container)return;
      if(navMap){navMap.remove();navMap=null;}
      navMap=L.map(container,{center:[lat,lng],zoom:9,zoomControl:false,attributionControl:false});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,minZoom:4,opacity:0.7}).addTo(navMap);
      L.marker([lat,lng]).addTo(navMap).bindPopup('Zona Rekomendasi');
      if(UI.currentCoords){
        const clat=UI.currentCoords.lat,clng=UI.currentCoords.lng;
        L.circleMarker([clat,clng],{radius:8,color:'#1976D2',fillColor:'#1976D2',fillOpacity:0.8}).addTo(navMap).bindPopup('Lokasi Saya');
        L.polyline([[clat,clng],[lat,lng]],{color:'#1976D2',weight:3,dashArray:'8,6',opacity:0.7}).addTo(navMap);
        navMap.fitBounds([[clat,clng],[lat,lng]],{padding:[30,30]});
      }
      setTimeout(()=>navMap.invalidateSize(),200);
    },100);
  };
})();
