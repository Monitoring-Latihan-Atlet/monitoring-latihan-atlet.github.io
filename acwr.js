/* =====================================================================
   ACWR (Acute:Chronic Workload Ratio) — zona risiko, kartu, kurva, dan seri harian.
   Dipakai index.html (pelatih) dan atlet.html (atlet).
   ACWR = beban 7 hari terakhir ÷ rata-rata beban mingguan 4 minggu terakhir.
   Zona menurut Gabbett (2016), Br J Sports Med:
     < 0,80   underload        risiko penurunan kondisi (deconditioning)
     0,80–1,29 optimal          risiko cedera rendah
     1,30–1,49 risiko meningkat risiko cedera ±2–3× lebih tinggi
     ≥ 1,50   zona bahaya      risiko cedera ±4–5× lebih tinggi

   Penggabungan dengan model fitness–fatigue (CTL 42 hari, ATL 7 hari):
     Form %     = (CTL − ATL) ÷ CTL × 100   (seperti intervals.icu)
     ACWR EWMA  = ATL ÷ CTL = 1 − Form%/100
   sehingga Form −30% ≈ ACWR 1,3 dan Form −50% = ACWR 1,5. Status gabungan memakai
   zona yang PALING WASPADA dari ACWR rolling (7:28) dan ACWR EWMA. Form % baru dinilai
   setelah ≥ 4 minggu data dan CTL ≥ 10, karena saat kebugaran masih kecil persentasenya
   menyesatkan. Fitness & fatigue diawali dari rata-rata beban harian 4 minggu pertama
   (bukan dari 0) agar rasio fatigue ÷ fitness tidak membesar palsu saat data baru dimulai.
   ===================================================================== */
(function(){
  const Z=[
    {k:"under",a:0,b:0.8,label:"Underload",sub:"Beban terlalu rendah",risk:"Risiko penurunan kondisi",warna:"#3b82f6",rentang:"< 0,80"},
    {k:"optimal",a:0.8,b:1.3,label:"Beban optimal",sub:"Zona aman",risk:"Risiko cedera rendah",warna:"#22c55e",rentang:"0,80 – 1,29"},
    {k:"naik",a:1.3,b:1.5,label:"Risiko meningkat",sub:"Lonjakan beban",risk:"Risiko cedera 2–3× lebih tinggi",warna:"#f59e0b",rentang:"1,30 – 1,49"},
    {k:"bahaya",a:1.5,b:9,label:"Zona bahaya",sub:"Lonjakan besar",risk:"Risiko cedera 4–5× lebih tinggi",warna:"#ef4444",rentang:"≥ 1,50"}];
  const zona=v=>v==null||!isFinite(v)?null:Z.find(z=>v>=z.a&&v<z.b)||Z[3];
  /* Zona Form % (intervals.icu) */
  const FZ=[
    {k:"transisi",a:20,b:1e9,label:"Transition",id:"Transisi",sub:"Terlalu segar — kebugaran mulai turun",warna:"#eab308"},
    {k:"segar",a:5,b:20,label:"Fresh",id:"Segar",sub:"Segar — siap tanding / sesi berat",warna:"#38bdf8"},
    {k:"abu",a:-10,b:5,label:"Grey zone",id:"Zona abu-abu",sub:"Pemeliharaan — beban stabil",warna:"#9ca3af"},
    {k:"optimal",a:-30,b:-10,label:"Optimal",id:"Optimal",sub:"Latihan produktif — kebugaran naik",warna:"#22c55e"},
    {k:"tinggi",a:-1e9,b:-30,label:"High risk",id:"Risiko tinggi",sub:"Kelelahan menumpuk — risiko cedera naik",warna:"#ef4444"}];
  const formZona=p=>p==null||!isFinite(p)?null:FZ.find(z=>p>=z.a&&p<z.b);
  /* Nilai awal fitness & fatigue: rata-rata beban harian 28 hari pertama sejak entri pertama. */
  const benih=(byDate,first)=>{let s=0;for(let k=0;k<28;k++)s+=byDate[addDays(first,k)]||0;return s/28};
  const formPct=(ctl,atl,umur)=>ctl>=10&&umur>=27?Math.round((ctl-atl)/ctl*100):null;
  /* Status gabungan: zona paling waspada dari ACWR rolling & EWMA, plus arti Form %. */
  function gabung(o){
    const vs=[o.acwr,o.acwrE].filter(v=>v!=null&&isFinite(v));if(!vs.length)return null;
    const zs=vs.map(zona);const has=k=>zs.some(z=>z.k===k);
    const z=has("bahaya")?Z[3]:has("naik")?Z[2]:zs.every(x=>x.k==="under")?Z[0]:Z[1];
    const fz=formZona(o.formPct);
    const saran=z.k==="bahaya"?"Kurangi beban segera — lonjakan beban besar. Ganti sesi berat dengan pemulihan sampai ACWR kembali < 1,3."
      :z.k==="naik"?"Tahan kenaikan beban minggu ini dan pantau wellness serta nyeri. Hindari sesi intensitas maksimal berturut-turut."
      :z.k==="under"?"Beban terlalu rendah dibanding biasanya — risiko kehilangan kondisi. Naikkan bertahap, ≤ 10–15% per minggu."
      :fz&&fz.k==="optimal"?"Zona latihan produktif: beban naik terkendali dan kebugaran sedang dibangun."
      :fz&&(fz.k==="segar"||fz.k==="transisi")?"Atlet segar — tepat untuk tanding, tes, atau sesi kualitas tinggi."
      :"Beban stabil (pemeliharaan). Tambah sedikit beban bila ingin meningkatkan kebugaran.";
    return{zona:z,fz,saran};
  }
  const dec=(v,d=2)=>(+v).toFixed(d).replace(".",",");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad=n=>String(n).padStart(2,"0");
  const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const parse=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
  const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};

  /* Seri harian {t, load, acwr}. byDate: {"YYYY-MM-DD": TSS}. ACWR baru dihitung setelah ≥21 hari data. */
  function seri(byDate,dari,sampai){
    const ds=Object.keys(byDate).filter(t=>byDate[t]!=null).sort();if(!ds.length)return[];
    const first=ds[0];const out=[];const lc=Math.exp(-1/42),la=Math.exp(-1/7);let C=benih(byDate,first),A=C;
    for(let t=first;t<=sampai;t=addDays(t,1)){
      const x=byDate[t]||0;C=lc*C+(1-lc)*x;A=la*A+(1-la)*x;if(t<dari)continue;
      let a=0,c=0;for(let k=0;k<28;k++){const l=byDate[addDays(t,-k)]||0;c+=l;if(k<7)a+=l}
      const umur=Math.round((parse(t)-parse(first))/864e5);const fp=formPct(C,A,umur);
      out.push({t,load:Math.round(x),acwr:umur>=20&&c>0?+(a/(c/4)).toFixed(2):null,ctl:+C.toFixed(1),atl:+A.toFixed(1),formPct:fp,acwrE:fp==null?null:+(A/C).toFixed(2)});
    }
    return out;
  }
  /* Perubahan beban 7 hari terakhir dibanding 7 hari sebelumnya (%). */
  function naikMingguan(byDate,t){let a=0,b=0;for(let k=0;k<14;k++){const l=byDate[addDays(t,-k)]||0;if(k<7)a+=l;else b+=l}return b>0?Math.round((a-b)/b*100):null}

  /* Kartu tangga risiko (gaya infografik Gabbett 2016) */
  function kartu(v,naik,ex){
    ex=ex||{};const g=gabung({acwr:v,acwrE:ex.acwrE,formPct:ex.formPct});const z=g&&g.zona;const show=v!=null?v:ex.acwrE;
    const rows=[...Z].reverse().map(x=>{const on=z&&z.k===x.k;
      return`<div class="acl${on?" on":""}" style="--zc:${x.warna}"><div><b>${x.label}</b><small>${x.risk}</small></div><span class="acr">${x.rentang}</span>${on?`<span class="acme">◀ ${v!=null?"rolling "+dec(v):""}${v!=null&&ex.acwrE!=null?" · ":""}${ex.acwrE!=null?"EWMA "+dec(ex.acwrE):""}</span>`:""}</div>`}).join("");
    const ind=(l,val,c)=>`<span class="acind" style="--zc:${c||"#7d889e"}"><small>${l}</small><b>${val}</b></span>`;
    const fz=g&&g.fz;
    const inds=`<div class="acinds">${ind("ACWR rolling 7:28",v!=null?dec(v):"–",v!=null?zona(v).warna:null)}${ind("ACWR EWMA",ex.acwrE!=null?dec(ex.acwrE):"–",ex.acwrE!=null?zona(ex.acwrE).warna:null)}${ind("Form %",ex.formPct!=null?(ex.formPct>0?"+":"")+ex.formPct+"%":"–",fz?fz.warna:null)}</div>`;
    const nk=naik==null?"":`<p class="acnote">Perubahan beban minggu ini: <b style="color:${naik>15?"#ef4444":naik>10?"#f59e0b":naik<-30?"#3b82f6":"#22c55e"}">${naik>0?"+":""}${naik}%</b> dibanding minggu lalu <span>(usahakan naik ≤ 10–15% per minggu)</span></p>`;
    return`<div class="acwrcard">${z?`<div class="achead" style="--zc:${z.warna}"><span class="acv">${dec(show)}</span><span><b>${z.label}${fz?` · <span style="color:${fz.warna}">${fz.id}</span>`:""}</b><small>${z.risk}</small></span></div><p class="acsaran" style="--zc:${z.warna}">${g.saran}</p>`:`<div class="achead"><span class="acv">–</span><span><b>Data belum cukup</b><small>ACWR muncul setelah ±3 minggu data latihan</small></span></div>`}${inds}${rows}${nk}<p class="acsrc">Status gabungan = zona paling waspada dari ACWR rolling (7:28) dan ACWR EWMA (= Fatigue ÷ Fitness = 1 − Form%). Jaga di 0,8–1,3 · Gabbett 2016; Form % mengikuti intervals.icu.</p></div>`;
  }
  /* Kurva beban – performa – cedera (gaya Gazzano 2016) dengan posisi atlet.
     titik: [{v, label}] — satu titik digambar sebagai bintang, banyak titik sebagai bulatan. */
  function kurva(titik,opt){
    opt=opt||{};const W=660,H=300,L=56,R=W-16,T=26,B=H-58;const lo=0.4,hi=2.0;
    const X=v=>L+(Math.min(hi,Math.max(lo,v))-lo)/(hi-lo)*(R-L);
    const Yp=x=>{const u=(x-1.28)/0.95;return T+12+(B-T-12)*Math.min(1,u*u*0.92)};
    const Yi=x=>{const v=0.12+0.55*Math.max(0,0.95-x)**1.6+1.9*Math.max(0,x-1.12)**2;return B-(B-T-10)*Math.min(1,v)};
    const path=f=>{let d="";for(let i=0;i<=80;i++){const x=lo+(hi-lo)*i/80;d+=(i?"L":"M")+X(x).toFixed(1)+" "+f(x).toFixed(1)}return d};
    const band=Z.map(z=>`<rect x="${X(Math.max(lo,z.a)).toFixed(1)}" y="${T}" width="${(X(Math.min(hi,z.b))-X(Math.max(lo,z.a))).toFixed(1)}" height="${B-T}" fill="${z.warna}" opacity=".13"/>`).join("");
    const strip=Z.map(z=>{const a=X(Math.max(lo,z.a)),b=X(Math.min(hi,z.b));return`<rect x="${a.toFixed(1)}" y="${B+8}" width="${(b-a-2).toFixed(1)}" height="20" rx="4" fill="${z.warna}" opacity=".9"/><text x="${((a+b)/2).toFixed(1)}" y="${B+22}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#06101f">${z.k==="under"?"Undertraining":z.k==="optimal"?"Optimal":z.k==="naik"?"1,3–1,5":"Overtraining"}</text>`}).join("");
    const vl=[0.8,1.3,1.5].map(v=>`<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${B}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/><text x="${X(v)}" y="${B+44}" text-anchor="middle" font-size="10" fill="#8c97ad">${dec(v,1)}</text>`).join("");
    const pk=X(1.28);
    let pts="";
    const P=(titik||[]).filter(p=>p&&p.v!=null&&isFinite(p.v));
    if(P.length===1){const p=P[0],x=X(p.v),y=Yp(p.v),z=zona(p.v);const r=13,ri=5.5;let s="";for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?ri:r;s+=(i?"L":"M")+(x+rr*Math.cos(a)).toFixed(1)+" "+(y+rr*Math.sin(a)).toFixed(1)}
      pts=`<path d="${s}Z" fill="#fde047" stroke="${z.warna}" stroke-width="2.5"/><g transform="translate(${Math.min(R-120,Math.max(L,x-60))},${y-46>=T+30?y-46:y+18})"><rect width="120" height="24" rx="12" fill="${z.warna}"/><text x="60" y="16" text-anchor="middle" font-size="12" font-weight="700" fill="#06101f">${esc(p.label||"ACWR")} ${dec(p.v)}</text></g>`}
    else pts=P.map((p,i)=>{const z=zona(p.v);const x=X(p.v),y=Yp(p.v)+((i%3)-1)*9;return`<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${z.warna}" stroke="#0b1220" stroke-width="2"><title>${esc(p.label)}: ACWR ${dec(p.v)} · ${z.label}</title></circle><text x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#06101f" pointer-events="none">${esc(p.inisial||"")}</text></g>`}).join("");
    return`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Kurva beban, performa, dan risiko cedera${P.length===1?": ACWR "+dec(P[0].v)+" ("+zona(P[0].v).label+")":""}" class="acwrcurve">
      <rect x="${L}" y="${T}" width="${R-L}" height="${B-T}" fill="#0b1426" stroke="#24304a"/>${band}${vl}
      <path d="${path(Yp)}" fill="none" stroke="#cbd5e1" stroke-width="3.5" stroke-linecap="round"/>
      <path d="${path(Yi)}" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round"/>
      <text x="${pk}" y="${T+8}" text-anchor="middle" font-size="11" font-weight="700" fill="#4ade80">▼ Performa puncak</text>
      ${strip}${pts}
      <text x="${L-12}" y="${(T+B)/2}" transform="rotate(-90 ${L-12} ${(T+B)/2})" text-anchor="middle" font-size="11" font-weight="700" fill="#8c97ad" letter-spacing="1">PERFORMA</text>
      <text x="${R}" y="${H-4}" text-anchor="end" font-size="11" font-weight="700" fill="#8c97ad" letter-spacing="1">BEBAN (ACWR) →</text>
      <g transform="translate(${R-200},${B-16})"><rect width="12" height="4" y="4" fill="#cbd5e1"/><text x="18" y="10" font-size="11" fill="#cbd5e1">Performa</text><rect x="86" width="12" height="4" y="4" fill="#ef4444"/><text x="104" y="10" font-size="11" fill="#fca5a5">Risiko cedera</text></g>
    </svg>`;
  }
  window.ACWR={Z,zona,FZ,formZona,formPct,benih,gabung,seri,naikMingguan,kartu,kurva};
})();
