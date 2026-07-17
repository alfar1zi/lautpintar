'use strict';
const UI={
  currentUser:null,currentHarbor:null,currentCoords:null,nearestHarborContext:null,
  currentSpecies:'tongkol',lastZoneData:null,lastWeatherData:null,

  _catLabel(cat){return {'HIGH':'TINGGI','MEDIUM':'SEDANG','LOW':'RENDAH','UNSAFE':'BAHAYA','AVOID':'HINDARI'}[cat]||cat;},

  show(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('screen-active'));
    const el=document.getElementById(id);if(el)el.classList.add('screen-active');
  },

  updateNav(screenId){
    document.querySelectorAll('.db-nav').forEach(n=>{
      const a=n.dataset.goto===screenId;
      n.classList.toggle('active',a);
    });
  },

  setGreeting(name){
    const g=document.querySelector('.db-greeting');
    if(g)g.textContent=`Hai, ${name||'Nelayan'}!`;
  },

  async loadZone(sp){
    if(!this.currentHarbor&&!this.currentCoords)return;
    const badge=document.getElementById('db-rekom-badge');if(badge){badge.textContent='Memuat...';document.getElementById('db-rekom')?.classList.remove('db-hide');}
    try{
      let d;const lat=this.currentCoords?.lat,lng=this.currentCoords?.lng;
      if(lat&&lng)d=await API.prediction.zone(null,sp,150,lat,lng);
      else d=await API.prediction.zone(this.currentHarbor.id,sp);
      this.showRecommendation(d);
    }catch(e){
      if(e.status===401){localStorage.removeItem('lp_user_id');UI.show('screen-login');return;}
      console.warn('loadZone failed',e);
    }
  },

  showRecommendation(data){
    this.lastZoneData=data;const rec=data.top_recommendation;
    const nodata=document.getElementById('db-nodata');
    const sections=document.querySelectorAll('#db-kondisi,#db-rekom,#db-forecast,#db-nav-btn');
    sections.forEach(s=>s.classList.remove('db-hide'));
    if(!rec){sections.forEach(s=>s.classList.add('db-hide'));if(nodata)nodata.style.display='';return;}
    if(nodata)nodata.style.display='none';
    this.renderDashboard(rec,data);
    this.loadWeather();
  },

  async loadWeather(){
    try{
      let lat,lng;
      if(this.currentCoords){lat=this.currentCoords.lat;lng=this.currentCoords.lng;}
      else if(this.currentHarbor){lat=this.currentHarbor.lat;lng=this.currentHarbor.lng;}
      else return;
      const w=await API.prediction.weather(lat,lng);
      this.lastWeatherData=w;
      this.updateKondisiCard(w);
      this.updateForecast(w);
    }catch(e){console.warn('failed',e);}
  },

  updateKondisiCard(w){
    const wave=w?.wave_height_m,wind=w?.wind_speed_ms;
    document.getElementById('db-wave').textContent=wave!=null?`${wave.toFixed(1)} m`:'-';
    document.getElementById('db-wind').textContent=wind!=null?`${Math.round(wind*3.6)} km/h`:'-';
    const badge=document.getElementById('db-badge'),status=document.getElementById('db-status'),text=document.getElementById('db-ktext');
    const safetyMap={'BAHAYA':{bg:'#FFEBEE',fg:'#C62828',txt:'Kondisi berbahaya. Jangan berlayar.'},'WASPADA':{bg:'#FFF3E0',fg:'#E65100',txt:'Kondisi perlu diwaspadai.'},'AMAN':{bg:'#E8F5E9',fg:'#2E7D32',txt:'Aman untuk melaut'}};
    if(wind!=null&&wind>15){const s=safetyMap['BAHAYA'];badge.style.background=s.bg;badge.style.color=s.fg;status.textContent='BAHAYA';text.textContent='Angin kencang. Jangan berlayar.';return;}
    if(w?.weather_available&&wave!=null){
      const key=wave>2.5?'BAHAYA':wave>1.5?'WASPADA':'AMAN';
      const s=safetyMap[key];badge.style.background=s.bg;badge.style.color=s.fg;status.textContent=key;text.textContent=s.txt;
    }
  },

  renderDashboard(rec,data){
    document.getElementById('db-rekom-dir').textContent=`Arah ${rec.direction||'-'}`;
    document.getElementById('db-rekom-bearing').textContent=`${Math.round(rec.bearing_degrees||0)}°`;
    document.getElementById('db-rekom-dist').textContent=`${Math.round(rec.distance_km||0)} km`;
    const c=this._catLabel(rec.category);
    document.getElementById('db-rekom-badge').textContent=c||rec.category;
    const conf={'HIGH':'Tinggi','MEDIUM':'Sedang','LOW':'Rendah'}[rec.category]||'-';
    document.getElementById('db-rekom-conf').textContent=conf;
    const sst=rec.sst_celsius!=null?`${rec.sst_celsius.toFixed(1)}°C`:'-';
    document.getElementById('db-sst').textContent=sst;
  },

  updateForecast(w){
    const sc=document.getElementById('db-fc-scroll');
    if(!sc)return;
    const h=w?.hourly||[];
    if(h.length){
      sc.innerHTML=h.slice(0,8).map((x,i)=>`<div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px;border-radius:16px;background:#fff;border:1px solid rgba(13,71,161,0.06);min-width:64px;${i===0?'background:#1976D2;color:#fff;border-color:#1976D2;':''}"><span style="font-size:11px;font-weight:500;color:${i===0?'#fff':'#717783'}">${x.time.includes('T')?x.time.split('T')[1].slice(0,5):x.time}</span><span style="font-size:13px;font-weight:700;color:${i===0?'#fff':'#051E28'}">${x.temp_c!=null?`${Math.round(x.temp_c)}°C`:'--°C'}</span></div>`).join('');
    }else{
      sc.innerHTML='<span style="color:rgba(255,255,255,0.6);font-size:13px;">Data prakiraan belum tersedia</span>';
    }
  },

  showPetaDetail(zone,dist,bearing,dir){
    const cat=this._catLabel(zone.category);
    const badgeEl=document.getElementById('pd-badge');
    const cc={'TINGGI':{bg:'#E8F5E9',fg:'#2E7D32'},'SEDANG':{bg:'#FFF3E0',fg:'#E65100'},'RENDAH':{bg:'#FFF8E1',fg:'#F9A825'},'BAHAYA':{bg:'#FFEBEE',fg:'#C62828'}}[cat]||{bg:'#E8F5E9',fg:'#2E7D32'};
    badgeEl.textContent=cat;
    badgeEl.style.background=cc.bg;
    badgeEl.style.color=cc.fg;
    document.getElementById('pd-coord-text').textContent=`${zone.zone_lat?.toFixed(4)||zone.lat?.toFixed(4)||'-'}, ${zone.zone_lng?.toFixed(4)||zone.lng?.toFixed(4)||'-'}`;
    const dur=Math.max(1,Math.round((dist||0)/15));
    document.getElementById('pd-time').textContent=`Sekitar ${dur} jam dari lokasi (${Math.round(dist||0)} km)`;
    const sst=zone.sst_celsius!=null?`${zone.sst_celsius.toFixed(1)}°C`:'-';
    document.getElementById('pd-sst').textContent=sst;
    const fuel=Math.round((dist||0)*2*0.5);
    document.getElementById('pd-bbm').textContent=`${fuel} L`;
    document.getElementById('pd-best-time').textContent=zone.reasoning||'Kondisi diperkirakan stabil.';
    const tags=document.getElementById('pd-species');
    tags.innerHTML=`<span class="pd-tag">${UI.currentSpecies||'-'}</span>`;
    this.fetchWeatherForDetail();
    this.show('screen-peta-detail');
    document.querySelectorAll('.db-nav').forEach(n=>n.classList.remove('active'));
  },

  async fetchWeatherForDetail(){
    try{
      let lat,lng;
      if(this.currentCoords){lat=this.currentCoords.lat;lng=this.currentCoords.lng;}
      else if(this.currentHarbor){lat=this.currentHarbor.lat;lng=this.currentHarbor.lng;}
      else return;
      const w=await API.prediction.weather(lat,lng);
      if(w?.weather_available){
        document.getElementById('pd-wave').textContent=w.wave_height_m!=null?`${w.wave_height_m.toFixed(1)} m`:'-';
        document.getElementById('pd-wind').textContent=w.wind_speed_ms!=null?`${Math.round(w.wind_speed_ms*3.6)} km/h`:'-';
      }
    }catch(e){console.warn('failed',e);}
  },

  async loadRiwayat(){
    const list=document.getElementById('rw-list');
    if(!list)return;
    list.innerHTML='<span style="text-align:center;padding:20px;color:#717783;">Memuat...</span>';
    try{
      const d=await API.feedback.trips(100,0);
      list.innerHTML='';
      if(!d.trips||d.trips.length===0){
        list.innerHTML='<span style="text-align:center;padding:20px;color:#717783;">Belum ada perjalanan tercatat.</span>';
        document.getElementById('rw-total-trip').textContent='0 Perjalanan';
        document.getElementById('rw-total-catch').textContent='-';
        return;
      }
      const trips=d.trips;
      document.getElementById('rw-total-trip').textContent=`${trips.length} Perjalanan`;
      const totalCatch=trips.reduce((s,r)=>s+(parseFloat(r.catch_kg)||0),0);
      document.getElementById('rw-total-catch').textContent=totalCatch>0?`${totalCatch>=1000?(totalCatch/1000).toFixed(1)+' Ton':Math.round(totalCatch)+' kg'}`:'-';
      const now=new Date();
      const filtered=trips.filter(r=>{
        const date=new Date(r.trip_date+'T00:00:00');
        const filter=document.querySelector('[data-rwf].active');
        const f=filter?filter.dataset.rwf:'ALL';
        if(f==='WEEK'){const s=new Date(now);s.setDate(now.getDate()-now.getDay());s.setHours(0,0,0,0);return date>=s;}
        if(f==='MONTH'){return date.getMonth()===now.getMonth()&&date.getFullYear()===now.getFullYear();}
        return true;
      });
      if(filtered.length===0){
        list.innerHTML='<span style="text-align:center;padding:20px;color:#717783;">Tidak ada perjalanan di periode ini.</span>';return;
      }
      filtered.forEach(r=>{
        const card=document.createElement('div');card.className='rw-card';
        const dateStr=new Date(r.trip_date+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
        const catchStr=r.catch_kg!=null&&parseFloat(r.catch_kg)>0?`${parseFloat(r.catch_kg)} kg`:'Tidak dapat';
        card.innerHTML=`<div><strong>${r.species||'-'}</strong><br><span style="font-size:12px;color:#717783;">${dateStr}</span></div><div style="text-align:right;font-weight:700;">${catchStr}</div>`;
        list.appendChild(card);
      });
    }catch(e){list.innerHTML='<span style="text-align:center;padding:20px;color:#BA1A1A;">Gagal memuat riwayat.</span>';}
  },

  getTopRec(){
    return this.lastZoneData?.top_recommendation||null;
  }
};
