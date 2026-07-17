const API={BASE:'/api/v1',TIMEOUT:30000,
  async fetchWithTimeout(url,options={}){
    const c=new AbortController();const t=setTimeout(()=>c.abort(),this.TIMEOUT);
    try{const r=await fetch(url,{...options,signal:c.signal});clearTimeout(t);return r}
    catch(e){clearTimeout(t);if(e.name==='AbortError')throw Object.assign(new Error('Koneksi terlalu lambat. Coba lagi.'),{status:0,code:'TIMEOUT'});
    throw Object.assign(new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.'),{status:0,code:'NETWORK_ERROR'});}},
  async _request(method,path,body){
    const opts={method,credentials:'include'};
    if(body){opts.headers={'Content-Type':'application/json'};opts.body=JSON.stringify(body);}
    let r=await this.fetchWithTimeout(`${this.BASE}${path}`,opts);
    if(!r.ok&&r.status===401){
      await this.fetchWithTimeout(`${this.BASE}/auth/refresh`,{method:'POST',credentials:'include'}).catch(()=>{});
      r=await this.fetchWithTimeout(`${this.BASE}${path}`,opts);
    }
    if(!r.ok){const e=await r.json().catch(()=>({detail:null}));throw Object.assign(new Error(e.detail||this.getErrorMessage(r.status)),{status:r.status})}
    return r.json();},
  async post(path,body){return this._request('POST',path,body);},
  async put(path,body){return this._request('PUT',path,body);},
  async get(path){return this._request('GET',path);},
  getErrorMessage(s,d='Terjadi kesalahan'){return {400:'Data tidak valid',401:'Sesi berakhir. Silakan masuk kembali',403:'Akses ditolak',404:'Data tidak ditemukan',429:'Terlalu banyak permintaan',500:'Server bermasalah',503:'Layanan tidak tersedia'}[s]||d;},
  auth:{login:(e,p)=>API.post('/auth/login',{email:e,password:p}),register:d=>API.post('/auth/register',d),logout:()=>API.post('/auth/logout',{}),me:()=>API.get('/user/me'),update:d=>API.put('/user/me',d)},
  harbor:{list:()=>API.get('/harbor/list'),nearest:(lat,lng)=>API.get(`/harbor/nearest?lat=${lat}&lng=${lng}`)},
  feedback:{trips:(l=20,o=0)=>API.get(`/feedback/trips?limit=${l}&offset=${o}`)},
  prediction:{zone:(id,sp,r=150,lat=null,lng=null)=>lat!==null&&lng!==null?API.get(`/prediction/zone?lat=${lat}&lng=${lng}&species=${sp}&radius_km=${r}`):API.get(`/prediction/zone?harbor_id=${id}&species=${sp}&radius_km=${r}`),
  weather:(lat,lng)=>API.get(`/prediction/weather?lat=${lat}&lng=${lng}`)}
};
