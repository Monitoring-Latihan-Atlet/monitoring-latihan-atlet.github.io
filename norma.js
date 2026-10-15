/* =====================================================================
   Norma tes kondisi fisik — dipakai index.html (pelatih) dan atlet.html (atlet).
   Ubah angka norma di sini saja.
   ===================================================================== */
(function(){
/* Norma 1–5 dari lembar "Tes Pengukuran". cut = batas skala 5,4,3,2.
   dir -1: lebih kecil lebih baik (v<c5 → 5, v≤c4 → 4, v≤c3 → 3, v≤c2 → 2, selain itu 1)
   dir +1: lebih besar lebih baik (v>c5 → 5, v≥c4 → 4, v≥c3 → 3, v≥c2 → 2, selain itu 1)
   rel: hasil dibagi berat badan (× BB) sebelum dibandingkan. */
const TESTS=[
  {key:"sprint30",label:"Sprint 30 m",short:"Sprint 30 m",unit:"detik",dir:-1,min:3,max:9,step:0.01,komp:"Kecepatan",norm:{L:[4.0,4.3,4.7,5.1],P:[4.5,4.8,5.2,5.6]},nt:"detik",hint:"Start berdiri, ambil waktu terbaik dari 2 percobaan."},
  {key:"ttest",label:"T-Test (agility)",short:"T test",unit:"detik",dir:-1,min:7,max:20,step:0.01,komp:"Kelincahan",norm:{L:[9.5,10.5,11.5,12.5],P:[10.5,11.5,12.5,13.5]},nt:"detik",hint:"Waktu terbaik dari 2 percobaan."},
  {key:"cone3",label:"3 Cone Drill",short:"3 Cone Drill",unit:"detik",dir:-1,min:5,max:16,step:0.01,komp:"Kelincahan",norm:{L:[7.5,8.0,9.0,10.0],P:[8.5,9.0,10.0,11.0]},nt:"detik",hint:"Waktu terbaik dari 2 percobaan."},
  {key:"yoyo",label:"Yo-Yo Intermittent Recovery L1",short:"Yo-Yo Intermittent",unit:"meter",dir:1,min:0,max:4000,step:40,komp:"Daya tahan",norm:{L:[2000,1800,1500,1000],P:[1500,1300,1000,700]},nt:"meter",hint:"Total jarak tempuh (kelipatan 40 m)."},
  {key:"squat",label:"Half Squat (1RM)",short:"Half Squat",unit:"kg",dir:1,min:10,max:400,step:0.5,komp:"Kekuatan maksimal",rel:true,norm:{L:[2.0,1.8,1.5,1.2],P:[1.5,1.3,1.0,0.8]},nt:"× BB",hint:"Isi beban 1RM dalam kg; dinilai sebagai kelipatan berat badan."},
  {key:"bench",label:"Bench Press (1RM)",short:"Bench Press",unit:"kg",dir:1,min:5,max:300,step:0.5,komp:"Kekuatan maksimal",rel:true,norm:{L:[1.5,1.3,1.0,0.8],P:[1.0,0.8,0.6,0.4]},nt:"× BB",hint:"Isi beban 1RM dalam kg."},
  {key:"deadlift",label:"Deadlift (1RM)",short:"Deadlift",unit:"kg",dir:1,min:10,max:400,step:0.5,komp:"Kekuatan maksimal",rel:true,norm:{L:[2.5,2.0,1.5,1.2],P:[2.0,1.8,1.5,1.2]},nt:"× BB",hint:"Isi beban 1RM dalam kg."},
  {key:"vj",label:"Vertical Jump",short:"Vertical Jump",unit:"cm",dir:1,min:5,max:120,step:0.5,komp:"Power",norm:{L:[70,60,50,40],P:[50,40,30,20]},nt:"cm",hint:"Selisih raihan lompat dan raihan berdiri."},
  {key:"pushup",label:"Push-Up (60 detik)",short:"Push Up",unit:"kali",dir:1,min:0,max:120,step:1,komp:"Daya tahan otot",norm:{L:[50,40,30,20],P:[35,30,20,10]},nt:"kali",hint:"Repetisi benar dalam 60 detik."},
  {key:"situp",label:"Sit-Up (60 detik)",short:"Sit Up",unit:"kali",dir:1,min:0,max:120,step:1,komp:"Daya tahan otot",norm:{L:[55,45,35,25],P:[55,45,35,25]},nt:"kali",hint:"Repetisi benar dalam 60 detik."},
  {key:"wallsit",label:"Wall Sit (statik, waktu maksimal)",short:"Wall Sit",unit:"detik",dir:1,min:0,max:600,step:1,komp:"Daya tahan otot",norm:{L:[120,90,60,30],P:[120,90,60,30]},nt:"detik",hint:"Waktu bertahan sampai posisi lutut 90° tidak terjaga."},
  {key:"sitreach",label:"Sit and Reach (fleksibilitas)",short:"Sit and Reach Test",unit:"cm",dir:1,min:-20,max:60,step:0.5,komp:"Fleksibilitas",norm:{L:[35,25,15,5],P:[35,25,15,5]},nt:"cm",hint:"Jangkauan terjauh dari 3 percobaan."}
];
const SKALA=["","Kurang sekali","Kurang","Sedang","Baik","Baik sekali"];
function skalaOf(t,v,jk,bb){
  if(v==null||v===""||!isFinite(+v))return null;
  let x=+v;if(t.rel){if(!bb)return null;x=x/bb}
  const c=t.norm[jk==="P"?"P":"L"];
  if(t.dir<0){if(x<c[0])return 5;if(x<=c[1])return 4;if(x<=c[2])return 3;if(x<=c[3])return 2;return 1}
  if(x>c[0])return 5;if(x>=c[1])return 4;if(x>=c[2])return 3;if(x>=c[3])return 2;return 1;
}
window.NORMA={TESTS,SKALA,skalaOf};
})();
