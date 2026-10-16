/* =====================================================================
   Impor aktivitas dari jam / aplikasi — dipakai index.html dan atlet.html.
   Format: .fit (Garmin, Coros, Polar, Suunto, Wahoo), .gpx, .tcx, versi .gz-nya,
   activities.csv dari ekspor Strava, dan Activities.csv dari Garmin Connect.
   Hasil: [{mulai: Date, tanggal: "YYYY-MM-DD", durasi: menit, hr, hrmax, km, olahraga, jenis, nama}]
   Semua dibaca di perangkat; file tidak diunggah ke mana pun.
   ===================================================================== */
(function(){
  const pad=n=>String(n).padStart(2,"0");
  const isoLocal=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const JENIS=[[/run|lari|jog|walk|jalan|hike|ride|bik|cycl|sepeda|swim|renang|row|ski|elliptical|cardio|treadmill/i,"Daya tahan"],
    [/weight|strength|gym|crossfit|kekuatan|beban/i,"Kekuatan"],[/yoga|stretch|pilates|recovery|mobility|meditat/i,"Pemulihan"],
    [/soccer|football|futsal|basket|volley|badminton|tennis|sepak|bola|bulu|takraw|silat|karate|taekwondo|martial|rugby/i,"Teknik"],
    [/workout|hiit|training|interval|fitness|sprint/i,"Fisik"]];
  const jenisDari=s=>{for(const[re,j]of JENIS)if(re.test(s||""))return j;return null};
  const ok=v=>v!=null&&isFinite(v)&&v>0;
  function jadi(a){
    if(!a.mulai||isNaN(a.mulai)||!ok(a.detik))return null;
    return{mulai:a.mulai,tanggal:isoLocal(a.mulai),durasi:Math.max(1,Math.round(a.detik/60)),
      hr:ok(a.hr)&&a.hr<240?Math.round(a.hr):null,hrmax:ok(a.hrmax)&&a.hrmax<250?Math.round(a.hrmax):null,
      km:ok(a.m)?Math.round(a.m/10)/100:null,olahraga:a.olahraga||"",jenis:jenisDari(a.olahraga+" "+(a.nama||"")),nama:a.nama||""};
  }
  const hav=(a,b)=>{const R=6371e3,r=x=>x*Math.PI/180;const d1=r(b[0]-a[0]),d2=r(b[1]-a[1]);const h=Math.sin(d1/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
  const stat=hrs=>{const v=hrs.filter(x=>ok(x)&&x<250);return v.length?{hr:v.reduce((x,y)=>x+y,0)/v.length,hrmax:Math.max(...v)}:{}};

  /* ---------- FIT (biner) ---------- */
  const FIT_SPORT={0:"Umum",1:"Lari",2:"Sepeda",4:"Fitness",5:"Renang",6:"Bola basket",7:"Sepak bola",8:"Tenis",10:"Latihan",11:"Jalan",13:"Ski",17:"Hiking",19:"Mendayung",20:"Latihan kekuatan"};
  const FIT_SPORT_EN={1:"run",2:"ride",4:"fitness",5:"swim",6:"basketball",7:"soccer",8:"tennis",10:"training",11:"walk",17:"hike",19:"row",20:"strength"};
  function parseFit(buf){
    const dv=new DataView(buf);if(buf.byteLength<14)throw new Error("File FIT terlalu kecil");
    const hs=dv.getUint8(0);
    if(String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11))!==".FIT")throw new Error("Bukan file FIT");
    const end=Math.min(hs+dv.getUint32(4,true),buf.byteLength);
    const defs={},recs=[],sess=[];let p=hs,last=0,sport=null;
    const INV={1:0xFF,2:0xFFFF,4:0xFFFFFFFF};
    const rd=(size,pos,le)=>{if(pos+size>buf.byteLength)return null;const v=size===1?dv.getUint8(pos):size===2?dv.getUint16(pos,le):size===4?dv.getUint32(pos,le):null;return v===INV[size]?null:v};
    const data=(d,cts)=>{const o={};for(const f of d.f){o[f.num]=rd(f.size,p,d.le);p+=f.size}p+=d.dev;
      if(o[253]!=null)last=o[253];const ts=o[253]!=null?o[253]:cts;
      if(d.g===20)recs.push({ts,hr:o[3],dist:o[5]});else if(d.g===18)sess.push(o);else if(d.g===12&&o[0]!=null&&sport==null)sport=o[0]};
    while(p<end){
      const h=dv.getUint8(p++);
      if(h&0x80){const d=defs[(h>>5)&3];if(!d)break;const off=h&0x1F;let ts=(last&~0x1F)+off;if(off<(last&0x1F))ts+=0x20;last=ts;data(d,ts);continue}
      const lt=h&0x0F;
      if(h&0x40){p++;const le=dv.getUint8(p++)===0;const g=dv.getUint16(p,le);p+=2;const n=dv.getUint8(p++);const f=[];
        for(let i=0;i<n;i++){f.push({num:dv.getUint8(p),size:dv.getUint8(p+1)});p+=3}
        let dev=0;if(h&0x20){const nd=dv.getUint8(p++);for(let i=0;i<nd;i++){dev+=dv.getUint8(p+1);p+=3}}
        defs[lt]={g,le,f,dev};continue}
      const d=defs[lt];if(!d)break;data(d,null);
    }
    const T=ts=>new Date((ts+631065600)*1000);
    const out=[];
    if(sess.length)sess.forEach(o=>{const sp=o[5]!=null?o[5]:sport;const st=o[2]!=null?o[2]:(recs[0]&&recs[0].ts);
      let hr=o[16],hrmax=o[17];if(hr==null){const x=stat(recs.map(r=>r.hr));hr=x.hr;hrmax=hrmax||x.hrmax}
      out.push(jadi({mulai:st!=null?T(st):null,detik:(o[8]!=null?o[8]:o[7])/1000,m:o[9]!=null?o[9]/100:null,hr,hrmax,olahraga:FIT_SPORT_EN[sp]||"",nama:FIT_SPORT[sp]||"Aktivitas"}))});
    else if(recs.length>1){const ts=recs.map(r=>r.ts).filter(v=>v!=null);const x=stat(recs.map(r=>r.hr));const ds=recs.map(r=>r.dist).filter(v=>v!=null);
      out.push(jadi({mulai:T(Math.min(...ts)),detik:Math.max(...ts)-Math.min(...ts),m:ds.length?Math.max(...ds)/100:null,hr:x.hr,hrmax:x.hrmax,olahraga:FIT_SPORT_EN[sport]||"",nama:FIT_SPORT[sport]||"Aktivitas"}))}
    return out.filter(Boolean);
  }

  /* ---------- GPX & TCX (XML) ---------- */
  const xml=t=>{const d=new DOMParser().parseFromString(t,"application/xml");if(d.getElementsByTagName("parsererror").length)throw new Error("File tidak bisa dibaca");return d};
  const tags=(el,n)=>[...el.getElementsByTagNameNS("*",n)];
  const first=(el,n)=>{const x=tags(el,n)[0];return x?x.textContent.trim():null};
  function parseGpx(t){
    const d=xml(t);return tags(d,"trk").map(trk=>{
      const pts=tags(trk,"trkpt");const times=[],hrs=[];let m=0,prev=null;
      pts.forEach(pt=>{const tm=first(pt,"time");if(tm)times.push(Date.parse(tm));const h=first(pt,"hr");if(h)hrs.push(+h);
        const c=[+pt.getAttribute("lat"),+pt.getAttribute("lon")];if(prev&&isFinite(c[0]))m+=hav(prev,c);prev=c});
      const tt=times.filter(isFinite);if(tt.length<2)return null;const x=stat(hrs);
      return jadi({mulai:new Date(Math.min(...tt)),detik:(Math.max(...tt)-Math.min(...tt))/1000,m,hr:x.hr,hrmax:x.hrmax,olahraga:first(trk,"type")||"",nama:first(trk,"name")||"Aktivitas GPX"});
    }).filter(Boolean);
  }
  function parseTcx(t){
    const d=xml(t);return tags(d,"Activity").map(a=>{
      const laps=tags(a,"Lap");let det=0,m=0,hw=0,hrmax=0;
      laps.forEach(l=>{const s=+first(l,"TotalTimeSeconds")||0;det+=s;m+=+first(l,"DistanceMeters")||0;
        const av=tags(l,"AverageHeartRateBpm")[0],mx=tags(l,"MaximumHeartRateBpm")[0];
        if(av)hw+=(+first(av,"Value")||0)*s;if(mx)hrmax=Math.max(hrmax,+first(mx,"Value")||0)});
      let hr=det&&hw?hw/det:null;
      if(!hr){const x=stat(tags(a,"HeartRateBpm").map(h=>+first(h,"Value")));hr=x.hr;hrmax=hrmax||x.hrmax}
      const id=first(a,"Id")||(laps[0]&&laps[0].getAttribute("StartTime"));
      return jadi({mulai:id?new Date(Date.parse(id)):null,detik:det,m,hr,hrmax,olahraga:a.getAttribute("Sport")||"",nama:a.getAttribute("Sport")||"Aktivitas TCX"});
    }).filter(Boolean);
  }

  /* ---------- CSV (Strava activities.csv, Garmin Connect Activities.csv) ---------- */
  function csvRows(t){
    const rows=[];let row=[],f="",q=false;
    for(let i=0;i<t.length;i++){const c=t[i];
      if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
      else if(c==='"')q=true;else if(c===","){row.push(f);f=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&t[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f=""}else f+=c}
    if(f||row.length){row.push(f);rows.push(row)}
    return rows.filter(r=>r.some(x=>x.trim()!==""));
  }
  const BULAN={jan:0,feb:1,mar:2,apr:3,may:4,mei:4,jun:5,jul:6,aug:7,agu:7,sep:8,oct:9,okt:9,nov:10,dec:11,des:11};
  function tglStrava(s){
    const m=s.match(/([A-Za-z]{3})\w*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/);
    if(m&&BULAN[m[1].toLowerCase()]!=null){let h=+m[4];if(m[7]==="PM"&&h<12)h+=12;if(m[7]==="AM"&&h===12)h=0;return new Date(Date.UTC(+m[3],BULAN[m[1].toLowerCase()],+m[2],h,+m[5],+m[6]))}
    const d=Date.parse(s);return isNaN(d)?null:new Date(d);
  }
  const hms=s=>{if(s==null||s==="")return null;if(/^\d+(\.\d+)?$/.test(s.trim()))return +s;const p=s.split(":").map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:null};
  const angka=s=>{if(s==null)return null;const v=parseFloat(String(s).replace(/,/g,""));return isFinite(v)?v:null};
  function parseCsv(t){
    const R=csvRows(t.replace(/^﻿/,""));if(R.length<2)return[];
    const H=R[0].map(h=>h.trim().toLowerCase());const col=(...ns)=>{for(const n of ns){const i=H.indexOf(n);if(i>=0)return i}return -1};
    const iStr=col("activity date"),iGar=col("date");
    if(iStr<0&&iGar<0)throw new Error("Kolom tanggal tidak ditemukan. Gunakan activities.csv dari Strava atau Activities.csv dari Garmin Connect.");
    const iType=col("activity type"),iName=col("activity name","title"),iMov=col("moving time"),iEl=col("elapsed time","time"),
      iDist=col("distance"),iHr=col("average heart rate","avg hr"),iMax=col("max heart rate","max hr");
    return R.slice(1).map(r=>{
      const mulai=iStr>=0?tglStrava(r[iStr]):(()=>{const m=(r[iGar]||"").match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);return m?new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]):null})();
      const det=hms(r[iMov])||hms(r[iEl]);const km=angka(r[iDist]);
      return jadi({mulai,detik:det,m:km!=null?(km>500?km:km*1000):null,hr:angka(r[iHr]),hrmax:angka(r[iMax]),olahraga:r[iType]||"",nama:r[iName]||r[iType]||"Aktivitas"});
    }).filter(Boolean);
  }

  async function gunzip(buf){
    if(typeof DecompressionStream!=="function")throw new Error("Browser ini belum bisa membuka file .gz. Ekstrak dulu lalu pilih file di dalamnya.");
    return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  async function baca(file){
    let name=file.name.toLowerCase();let buf=await file.arrayBuffer();
    if(name.endsWith(".gz")){buf=await gunzip(buf);name=name.slice(0,-3)}
    const text=()=>new TextDecoder("utf-8").decode(buf);
    let out;
    if(name.endsWith(".fit"))out=parseFit(buf);
    else if(name.endsWith(".gpx"))out=parseGpx(text());
    else if(name.endsWith(".tcx"))out=parseTcx(text());
    else if(name.endsWith(".csv"))out=parseCsv(text());
    else throw new Error("Format belum didukung. Pilih file .fit, .gpx, .tcx, atau .csv.");
    if(!out.length)throw new Error("Tidak ada aktivitas yang terbaca di file ini.");
    return out.sort((a,b)=>b.mulai-a.mulai);
  }
  /* Saran RPE dari rata-rata denyut jantung (% HRmax). Hanya saran; atlet tetap menyesuaikan. */
  function saranRpe(hr,hrmax){
    if(!hr||!hrmax)return null;const p=hr/hrmax;
    return p<.6?2:p<.65?3:p<.7?4:p<.75?5:p<.8?6:p<.85?7:p<.9?8:p<.95?9:10;
  }
  window.IMPOR={baca,saranRpe,_parseFit:parseFit,_parseCsv:parseCsv,_parseGpx:parseGpx,_parseTcx:parseTcx};
})();
