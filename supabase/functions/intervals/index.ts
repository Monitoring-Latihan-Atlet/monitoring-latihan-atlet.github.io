/* =====================================================================
   Supabase Edge Function "intervals" — sinkron otomatis intervals.icu → Monitoring Latihan Atlet.
   Gratis. Jam Garmin, Coros, Polar, Suunto, Wahoo, dll. disambungkan LANGSUNG ke intervals.icu
   (bukan lewat Strava — aktivitas dari Strava tidak boleh diambil lewat API intervals.icu).

   Atlet memasukkan API key intervals.icu sekali (intervals.icu → Settings → Developer Settings).
   API key disimpan di tabel intervals_akun yang tidak bisa dibaca dari aplikasi.

   Pengaturan di Supabase:
     • Matikan "Verify JWT / Enforce JWT verification" untuk fungsi ini.
     • (Opsional) Secret CRON_SECRET = kata acak, bila ingin sinkron terjadwal tiap jam
       lewat Integrations → Cron (POST {"aksi":"sinkron_semua"} dengan header x-cron-secret).
   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis.

   Permintaan (POST JSON):
     {aksi:"info"}                         → {ok}
     {aksi:"hubungkan", kode, apiKey}      → cek key, simpan, ambil 7 hari terakhir   (halaman atlet)
     {aksi:"sinkron", kode}                → ambil 7 hari terakhir                      (halaman atlet)
     {aksi:"putus", kode}                  → hapus API key                              (halaman atlet)
     {aksi:"sinkron_semua"}                → semua atlet yang boleh dilihat pelatih yang login
                                             (header Authorization: Bearer <token login>),
                                             atau semua atlet bila header x-cron-secret benar
   ===================================================================== */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON = Deno.env.get("CRON_SECRET") ?? "";
const adm = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ICU = "https://intervals.icu/api/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Siswa = { id: string; kode: string; tgl_lahir: string | null };
type Akun = { siswa_id: string; athlete_id: string; nama: string | null; api_key: string };

async function siswaDariKode(kode: unknown): Promise<Siswa | null> {
  if (typeof kode !== "string" || !UUID.test(kode)) return null;
  const { data } = await adm.from("siswa").select("id,kode,tgl_lahir").eq("kode", kode).maybeSingle();
  return data as Siswa | null;
}

async function icu(key: string, path: string) {
  const r = await fetch(ICU + path, { headers: { Authorization: "Basic " + btoa("API_KEY:" + key), Accept: "application/json" } });
  if (r.status === 401 || r.status === 403) throw new Error("API key intervals.icu salah atau sudah diganti. Salin ulang dari Settings → Developer Settings.");
  if (r.status === 429) throw new Error("intervals.icu sedang membatasi permintaan. Coba lagi beberapa menit lagi.");
  if (!r.ok) throw new Error("intervals.icu tidak merespons (" + r.status + ").");
  return r.json();
}

/* ---------- pemetaan aktivitas → sesi latihan ---------- */
const JENIS: [RegExp, string][] = [
  [/run|walk|hike|ride|bike|cycl|swim|row|ski|elliptical|stair|canoe|kayak|skate|wheelchair|velomobile/i, "Daya tahan"],
  [/weight|strength|crossfit/i, "Kekuatan"],
  [/yoga|pilates|stretch|recovery/i, "Pemulihan"],
  [/soccer|football|futsal|basket|volley|badminton|tennis|squash|pickleball|padel|racquet|golf|martial|boxing|silat|karate|taekwondo|rugby|hockey/i, "Teknik"],
  [/workout|hiit|training|interval|sprint/i, "Fisik"],
];
const jenisDari = (s: string) => { for (const [re, j] of JENIS) if (re.test(s)) return j; return null; };
function umur(tgl: string | null) {
  if (!tgl) return null;
  const b = new Date(tgl + "T00:00:00Z"), n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
/* RPE: dari RPE yang diisi atlet di intervals.icu bila ada; bila tidak, ditebak dari % HRmax (sama dengan impor file). */
function rpeDari(a: Record<string, any>, sis: Siswa): { rpe: number; tebak: boolean } {
  const pe = Number(a.icu_rpe ?? a.perceived_exertion);
  if (pe >= 1 && pe <= 10) return { rpe: Math.round(pe), tebak: false };
  const u = umur(sis.tgl_lahir);
  const hrmax = Math.max(u != null ? 208 - 0.7 * u : 0, Number(a.athlete_max_hr) || 0, Number(a.max_heartrate) || 0) || null;
  const hr = Number(a.average_heartrate) || 0;
  if (hr && hrmax) {
    const p = hr / hrmax;
    return { rpe: p < .6 ? 2 : p < .65 ? 3 : p < .7 ? 4 : p < .75 ? 5 : p < .8 ? 6 : p < .85 ? 7 : p < .9 ? 8 : p < .95 ? 9 : 10, tebak: true };
  }
  return { rpe: 5, tebak: true };
}

const isoHari = (d: Date) => d.toISOString().slice(0, 10);
async function simpanAktivitas(sis: Siswa, a: Record<string, any>): Promise<"baru" | "ada" | "lewat"> {
  if (String(a.source || "").toUpperCase() === "STRAVA") return "lewat"; /* data Strava tidak tersedia lewat API */
  const tanggal = String(a.start_date_local || "").slice(0, 10);
  const durasi = Math.round((Number(a.moving_time) || Number(a.elapsed_time) || 0) / 60);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || durasi < 1) return "lewat";
  if (tanggal < isoHari(new Date(Date.now() - 7 * 864e5))) return "lewat"; /* sama dengan batas 7 hari atlet_simpan */
  const id = "icu_" + a.id;
  const mulai = Date.parse(a.start_date || "");
  /* lewati bila sudah ada: aktivitas yang sama, atau file jam yang sama yang sudah diimpor manual (selisih ≤ 3 menit) */
  const { data: e } = await adm.from("entri").select("sesi").eq("siswa_id", sis.id).eq("tanggal", tanggal).maybeSingle();
  const ss: any[] = Array.isArray(e?.sesi) ? e!.sesi : [];
  if (ss.some((x) => x.id === id || (isFinite(mulai) && /^jam_\d+$/.test(x.id) && Math.abs(Number(x.id.slice(4)) - mulai) < 180000))) return "ada";
  const { rpe, tebak } = rpeDari(a, sis);
  const sesi: Record<string, unknown> = {
    id, jenis: jenisDari(String(a.type || "") + " " + String(a.name || "")), rpe, durasi: Math.min(400, durasi),
    hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    hrmax: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    km: a.distance ? Math.round(a.distance / 10) / 100 : null,
    sumber: "intervals", rpe_tebak: tebak,
  };
  const { error } = await adm.rpc("atlet_simpan", { p_kode: sis.kode, p_tanggal: tanggal, p_data: { sesi } });
  if (error) throw new Error(error.message);
  return "baru";
}

async function sinkron(sis: Siswa, akun: Akun) {
  const oldest = isoHari(new Date(Date.now() - 7 * 864e5)), newest = isoHari(new Date(Date.now() + 864e5));
  const list = await icu(akun.api_key, `/athlete/0/activities?oldest=${oldest}&newest=${newest}`);
  let baru = 0;
  for (const a of Array.isArray(list) ? list : []) if ((await simpanAktivitas(sis, a)) === "baru") baru++;
  await adm.from("intervals_akun").update({ sinkron_terakhir: new Date().toISOString() }).eq("siswa_id", sis.id);
  return baru;
}

async function akunDari(siswaId: string): Promise<Akun | null> {
  const { data } = await adm.from("intervals_akun").select("siswa_id,athlete_id,nama,api_key").eq("siswa_id", siswaId).maybeSingle();
  return data as Akun | null;
}

async function sinkronBanyak(ids: string[]) {
  let atlet = 0, baru = 0, gagal = 0;
  for (const id of ids) {
    const akun = await akunDari(id);
    const { data: s } = await adm.from("siswa").select("id,kode,tgl_lahir").eq("id", id).maybeSingle();
    if (!akun || !s) continue;
    try { baru += await sinkron(s as Siswa, akun); atlet++; } catch (_) { gagal++; }
  }
  return { atlet, baru, gagal };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: true });
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { return json({ error: "data tidak valid" }, 400); }
  try {
    if (b.aksi === "info") return json({ ok: true });

    if (b.aksi === "sinkron_semua") {
      /* jadwal otomatis: semua atlet yang terhubung */
      if (CRON && req.headers.get("x-cron-secret") === CRON) {
        const { data } = await adm.from("intervals_akun").select("siswa_id");
        return json({ ok: true, ...(await sinkronBanyak((data || []).map((r: any) => r.siswa_id))) });
      }
      /* pelatih yang login: hanya atlet yang boleh ia lihat (aturan sama dengan aplikasi) */
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!tok) return json({ error: "Perlu login." }, 401);
      const { data: u, error: ue } = await adm.auth.getUser(tok);
      if (ue || !u?.user) return json({ error: "Sesi login tidak valid." }, 401);
      const asUser = createClient(SB_URL, SB_ANON, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + tok } } });
      const { data, error } = await asUser.rpc("intervals_terhubung");
      if (error) throw new Error(error.message);
      return json({ ok: true, ...(await sinkronBanyak((data || []).map((r: any) => r.siswa_id))) });
    }

    const sis = await siswaDariKode(b.kode);
    if (!sis) return json({ error: "Tautan atlet tidak dikenal." }, 404);

    if (b.aksi === "hubungkan") {
      const key = typeof b.apiKey === "string" ? b.apiKey.trim() : "";
      if (!/^[\x21-\x7e]{8,200}$/.test(key)) return json({ error: "API key tidak valid. Salin dari intervals.icu → Settings → Developer Settings." }, 400);
      const ath = await icu(key, "/athlete/0");
      const nama = ath && (ath.name || [ath.firstname, ath.lastname].filter(Boolean).join(" ")) || null;
      const athleteId = String(ath && ath.id || "");
      if (!athleteId) throw new Error("Akun intervals.icu tidak ditemukan.");
      /* satu akun intervals.icu hanya untuk satu atlet */
      await adm.from("intervals_akun").delete().eq("athlete_id", athleteId).neq("siswa_id", sis.id);
      const { error } = await adm.from("intervals_akun").upsert({ siswa_id: sis.id, athlete_id: athleteId, nama, api_key: key, terhubung_pada: new Date().toISOString() });
      if (error) throw new Error(error.message);
      const akun = await akunDari(sis.id);
      const baru = akun ? await sinkron(sis, akun) : 0;
      return json({ ok: true, nama, baru });
    }
    if (b.aksi === "sinkron") {
      const akun = await akunDari(sis.id);
      if (!akun) return json({ error: "intervals.icu belum terhubung." }, 400);
      return json({ ok: true, baru: await sinkron(sis, akun) });
    }
    if (b.aksi === "putus") {
      await adm.from("intervals_akun").delete().eq("siswa_id", sis.id);
      return json({ ok: true });
    }
    return json({ error: "aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Gagal" }, 500);
  }
});
