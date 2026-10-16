/* =====================================================================
   Skor kesiapan harian 0–100 — dipakai index.html (pelatih) dan atlet.html (atlet).
   Gabungan berbobot dari komponen yang tersedia:
     kondisi pagi (wellness)  40%  dibanding baseline 28 hari atlet sendiri (z-score)
     form (fitness − fatigue) 25%  terlalu lelah menurunkan skor
     HRV pagi                 20%  dibanding rata-rata 28 hari (turun = kurang siap)
     nadi istirahat           15%  dibanding rata-rata 28 hari (naik = kurang siap)
   Hari yang biasa-biasa saja (sama dengan baseline) bernilai ±75.
   lalu dikurangi 4 poin per angka nyeri. Komponen yang tidak ada diabaikan.
   ≥70 siap latihan · 50–69 waspada · <50 perlu pemulihan. Ambang perlu dikalibrasi.
   ===================================================================== */
(function(){
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/Math.max(1,a.length-1))};
  const clamp=v=>Math.max(0,Math.min(100,v));
  const num=v=>v==null||v===""||!isFinite(+v)?null:+v;
  /* hari: {w, hr, hrv, nyeri} hari yang dinilai (w = total wellness 5–25)
     riwayat: [{w, hr, hrv}] hari-hari sebelumnya (maks. 28 hari)
     form: TSB hari itu atau null */
  function hitung(hari,riwayat,form){
    if(!hari||num(hari.w)==null)return null;
    const parts=[];const R=riwayat||[];
    const ws=R.map(r=>num(r.w)).filter(v=>v!=null);
    if(ws.length>=7){const z=(hari.w-mean(ws))/Math.max(1.5,sd(ws));parts.push(["Kondisi pagi",clamp(70+z*20),.4])}
    else parts.push(["Kondisi pagi",clamp((hari.w-5)/20*100),.4]);
    if(num(form)!=null){const f=+form;parts.push(["Form",f>=-10?(f>20?75:90):clamp(90+(f+10)*2.5),.25])}
    const hv=R.map(r=>num(r.hrv)).filter(v=>v!=null);
    if(num(hari.hrv)!=null&&hv.length>=4){const r=hari.hrv/mean(hv);parts.push(["HRV",clamp(70+(r-1)*250),.2])}
    const hs=R.map(r=>num(r.hr)).filter(v=>v!=null);
    if(num(hari.hr)!=null&&hs.length>=4){const d=hari.hr-mean(hs);parts.push(["Nadi istirahat",clamp(70-d*6),.15])}
    const wsum=parts.reduce((x,p)=>x+p[2],0);
    const skor=Math.round(clamp(parts.reduce((x,p)=>x+p[1]*p[2],0)/wsum-(num(hari.nyeri)||0)*4));
    const k=skor>=70?["hijau","Siap latihan","#5cc23a"]:skor>=50?["kuning","Waspada","#ffc000"]:["merah","Perlu pemulihan","#ff4b42"];
    return{skor,kat:k[0],label:k[1],warna:k[2],parts:parts.map(p=>({nama:p[0],nilai:Math.round(p[1])}))};
  }
  window.KESIAPAN={hitung};
})();
