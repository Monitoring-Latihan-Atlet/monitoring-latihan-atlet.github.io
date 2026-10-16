/* Service worker: membuat aplikasi bisa dipasang dan tetap terbuka saat sinyal lemah.
   - Halaman & config: ambil dari jaringan dulu, pakai salinan tersimpan bila offline.
   - Pustaka CDN, font & ikon: pakai salinan tersimpan, perbarui di latar belakang.
   - Permintaan data ke Supabase tidak pernah disimpan di cache. */
const CACHE="mla-v14";
const SHELL=["./","./index.html","./atlet.html","./config.js","./norma.js","./kesiapan.js","./impor.js","./acwr.js","./manifest.json","./manifest-atlet.json","./icon-192.png","./icon-512.png"];
const CDN=["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js","https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).then(()=>c.addAll(CDN).catch(()=>{}))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(/supabase\.co$/.test(u.hostname))return;
  const same=u.origin===location.origin;
  const isPage=r.mode==="navigate"||(same&&/\.(html|js|json)$/.test(u.pathname))||(same&&u.pathname.endsWith("/"));
  if(isPage&&same){
    e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res})
      .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match(u.pathname.endsWith("atlet.html")?"./atlet.html":"./index.html"))));
    return;
  }
  if(same||/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)){
    e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>{if(res.ok||res.type==="opaque"){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res}).catch(()=>m);return m||net}));
  }
});
