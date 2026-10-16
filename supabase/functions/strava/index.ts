/* =====================================================================
   Supabase Edge Function "strava" — sinkronisasi otomatis Strava → Monitoring Latihan Atlet.
   Garmin, Coros, Polar, Suunto, Wahoo, Apple Watch, dll. ikut masuk bila jamnya
   sudah tersambung ke Strava (sinkron otomatis jam → Strava → aplikasi ini).

   Rahasia yang perlu diisi di Supabase → Edge Functions → Secrets:
     STRAVA_CLIENT_ID      dari strava.com/settings/api
     STRAVA_CLIENT_SECRET  dari strava.com/settings/api   (JANGAN ditaruh di config.js)
     STRAVA_VERIFY_TOKEN   kata acak bebas, mis. "mla-webhook-8f2k"
   SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis.
   Matikan "Verify JWT / Enforce JWT verification" untuk fungsi ini, karena Strava
   memanggil fungsi ini tanpa token Supabase.

   Permintaan dari halaman atlet (POST JSON):
     {aksi:"info"}                         → {clientId}
     {aksi:"hubungkan", kode, code, scope} → tukar kode OAuth, simpan token, ambil 7 hari terakhir
     {aksi:"sinkron", kode}                → ambil aktivitas 7 hari terakhir
     {aksi:"putus", kode}                  → cabut izin & hapus token
   Webhook Strava: GET (validasi langganan) dan POST (event aktivitas baru/dihapus).
   ===================================================================== */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CID = Deno.env.get("STRAVA_CLIENT_ID") ?? "";
const CSEC = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
const VERIFY = Deno.env.get("STRAVA_VERIFY_TOKEN") ?? "";
const adm = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Siswa = { id: string; kode: string; tgl_lahir: string | null };
type Akun = { siswa_id: string; athlete_id: number; nama: string | null; access_token: string; refresh_token: string; expires_at: number };

async function siswaDariKode(kode: unknown): Promise<Siswa | null> {
  if (typeof kode !== "string" || !UUID.test(kode)) return null;
  const { data } = await adm.from("siswa").select("id,kode,tgl_lahir").eq("kode", kode).maybeSingle();
  return data as Siswa | null;
}

async function tokenStrava(body: Record<string, string>) {
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CID, client_secret: CSEC, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const t = JSON.stringify(j);
    if (/limit|exceeded|capacity/i.test(t)) throw new Error("Aplikasi Strava pelatih sudah mencapai batas jumlah atlet. Minta pelatih mengajukan penambahan kuota ke Strava.");
    throw new Error("Strava menolak permintaan (" + r.status + "). Coba hubungkan ulang.");
  }
  return j;
}

async function aksesToken(akun: Akun): Promise<string> {
  if (akun.expires_at > Date.now() / 1000 + 120) return akun.access_token;
  const t = await tokenStrava({ grant_type: "refresh_token", refresh_token: akun.refresh_token });
  await adm.from("strava_akun").update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at }).eq("siswa_id", akun.siswa_id);
  return t.access_token;
}

async function api(tok: string, path: string) {
  const r = await fetch("https://www.strava.com/api/v3" + path, { headers: { Authorization: "Bearer " + tok } });
  if (r.status === 429) throw new Error("Strava sedang membatasi permintaan. Coba lagi 15 menit lagi.");
  if (!r.ok) throw new Error("Strava API " + r.status);
  return r.json();
}

/* ---------- pemetaan aktivitas Strava → sesi latihan ---------- */
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
/* RPE: dari "perceived exertion" yang diisi di Strava bila ada; bila tidak, ditebak dari % HRmax (rumus sama dengan impor file). */
function rpeDari(a: Record<string, any>, sis: Siswa): { rpe: number; tebak: boolean } {
  const pe = Number(a.perceived_exertion);
  if (pe >= 1 && pe <= 10) return { rpe: Math.round(pe), tebak: false };
  const u = umur(sis.tgl_lahir);
  const hrmax = Math.max(u != null ? 208 - 0.7 * u : 0, Number(a.max_heartrate) || 0) || null;
  const hr = Number(a.average_heartrate) || 0;
  if (hr && hrmax) {
    const p = hr / hrmax;
    return { rpe: p < .6 ? 2 : p < .65 ? 3 : p < .7 ? 4 : p < .75 ? 5 : p < .8 ? 6 : p < .85 ? 7 : p < .9 ? 8 : p < .95 ? 9 : 10, tebak: true };
  }
  return { rpe: 5, tebak: true };
}

const isoHari = (d: Date) => d.toISOString().slice(0, 10);
async function simpanAktivitas(sis: Siswa, a: Record<string, any>): Promise<"baru" | "ada" | "lewat"> {
  const tanggal = String(a.start_date_local || a.start_date || "").slice(0, 10);
  const durasi = Math.round((Number(a.moving_time) || Number(a.elapsed_time) || 0) / 60);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || durasi < 1) return "lewat";
  if (tanggal < isoHari(new Date(Date.now() - 7 * 864e5))) return "lewat"; /* sama dengan batas 7 hari atlet_simpan */
  const id = "strava_" + a.id;
  const mulai = Date.parse(a.start_date);
  /* lewati bila sudah ada: sesi Strava yang sama, atau file jam yang sama yang sudah diimpor manual (selisih ≤ 3 menit) */
  const { data: e } = await adm.from("entri").select("sesi").eq("siswa_id", sis.id).eq("tanggal", tanggal).maybeSingle();
  const ss: any[] = Array.isArray(e?.sesi) ? e!.sesi : [];
  if (ss.some((x) => x.id === id || (/^jam_\d+$/.test(x.id) && Math.abs(Number(x.id.slice(4)) - mulai) < 180000))) return "ada";
  const { rpe, tebak } = rpeDari(a, sis);
  const sesi: Record<string, unknown> = {
    id, jenis: jenisDari(String(a.sport_type || a.type || "") + " " + String(a.name || "")), rpe, durasi: Math.min(400, durasi),
    hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    hrmax: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    km: a.distance ? Math.round(a.distance / 10) / 100 : null,
    sumber: "strava", rpe_tebak: tebak,
  };
  const { error } = await adm.rpc("atlet_simpan", { p_kode: sis.kode, p_tanggal: tanggal, p_data: { sesi } });
  if (error) throw new Error(error.message);
  return "baru";
}

async function sinkron(sis: Siswa, akun: Akun) {
  const tok = await aksesToken(akun);
  const after = Math.floor(Date.now() / 1000) - 8 * 86400;
  const list = await api(tok, `/athlete/activities?after=${after}&per_page=60`);
  let baru = 0;
  for (const a of Array.isArray(list) ? list : []) if ((await simpanAktivitas(sis, a)) === "baru") baru++;
  await adm.from("strava_akun").update({ sinkron_terakhir: new Date().toISOString() }).eq("siswa_id", sis.id);
  return baru;
}

/* Langganan webhook dibuat sekali secara otomatis saat atlet pertama menghubungkan Strava. */
async function pastikanWebhook(): Promise<string> {
  if (!VERIFY) return "STRAVA_VERIFY_TOKEN belum diisi";
  const q = `client_id=${encodeURIComponent(CID)}&client_secret=${encodeURIComponent(CSEC)}`;
  const ada = await fetch("https://www.strava.com/api/v3/push_subscriptions?" + q).then((r) => r.json()).catch(() => null);
  if (Array.isArray(ada) && ada.length) return "aktif";
  const r = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: q + `&callback_url=${encodeURIComponent(SB_URL + "/functions/v1/strava")}&verify_token=${encodeURIComponent(VERIFY)}`,
  });
  return r.ok ? "aktif" : "gagal (" + r.status + ")";
}

async function akunDari(sis: Siswa): Promise<Akun | null> {
  const { data } = await adm.from("strava_akun").select("*").eq("siswa_id", sis.id).maybeSingle();
  return data as Akun | null;
}

async function prosesEvent(ev: Record<string, any>) {
  const { data } = await adm.from("strava_akun").select("*").eq("athlete_id", ev.owner_id).maybeSingle();
  const akun = data as Akun | null;
  if (!akun) return;
  if (ev.object_type === "athlete") {
    if (ev.updates && String(ev.updates.authorized) === "false") await adm.from("strava_akun").delete().eq("siswa_id", akun.siswa_id);
    return;
  }
  if (ev.object_type !== "activity") return;
  const { data: s } = await adm.from("siswa").select("id,kode,tgl_lahir").eq("id", akun.siswa_id).maybeSingle();
  const sis = s as Siswa | null;
  if (!sis) return;
  if (ev.aspect_type === "create") {
    const a = await api(await aksesToken(akun), "/activities/" + ev.object_id);
    await simpanAktivitas(sis, a);
    await adm.from("strava_akun").update({ sinkron_terakhir: new Date().toISOString() }).eq("siswa_id", sis.id);
  } else if (ev.aspect_type === "delete") {
    /* pastikan aktivitas memang sudah dihapus di Strava (event palsu tidak bisa menghapus data) */
    const r = await fetch("https://www.strava.com/api/v3/activities/" + ev.object_id, { headers: { Authorization: "Bearer " + await aksesToken(akun) } });
    if (r.status !== 404) return;
    const id = "strava_" + ev.object_id;
    const { data: es } = await adm.from("entri").select("tanggal,sesi").eq("siswa_id", sis.id).gte("tanggal", isoHari(new Date(Date.now() - 7 * 864e5)));
    for (const e of es || []) if (Array.isArray(e.sesi) && e.sesi.some((x: any) => x.id === id))
      await adm.rpc("atlet_simpan", { p_kode: sis.kode, p_tanggal: e.tanggal, p_data: { hapus_sesi: id } });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  /* validasi langganan webhook Strava */
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.get("hub.mode") === "subscribe") {
      if (VERIFY && u.searchParams.get("hub.verify_token") === VERIFY) return json({ "hub.challenge": u.searchParams.get("hub.challenge") });
      return json({ error: "verify token salah" }, 403);
    }
    return json({ ok: true, siap: !!(CID && CSEC) });
  }
  if (req.method !== "POST") return json({ error: "metode tidak didukung" }, 405);
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { return json({ error: "data tidak valid" }, 400); }

  /* event webhook: balas cepat (< 2 detik), proses di latar belakang */
  if (b.object_type && b.owner_id) {
    const job = prosesEvent(b).catch((e) => console.error("webhook", e));
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && rt.waitUntil) rt.waitUntil(job); else await job;
    return json({ ok: true });
  }

  try {
    if (b.aksi === "info") return json({ clientId: CID || null });
    if (!CID || !CSEC) return json({ error: "Strava belum diatur oleh pelatih (STRAVA_CLIENT_ID / SECRET)." }, 503);
    const sis = await siswaDariKode(b.kode);
    if (!sis) return json({ error: "Tautan atlet tidak dikenal." }, 404);

    if (b.aksi === "hubungkan") {
      if (typeof b.code !== "string" || !b.code) return json({ error: "Kode Strava tidak ada." }, 400);
      if (typeof b.scope === "string" && !/activity:read/.test(b.scope)) return json({ error: "Izin melihat aktivitas belum dicentang. Hubungkan ulang dan centang izin aktivitas." }, 400);
      const t = await tokenStrava({ code: b.code, grant_type: "authorization_code" });
      const ath = t.athlete || {};
      const nama = [ath.firstname, ath.lastname].filter(Boolean).join(" ") || null;
      /* satu akun Strava hanya untuk satu atlet: lepas sambungan lama bila ada */
      await adm.from("strava_akun").delete().eq("athlete_id", ath.id).neq("siswa_id", sis.id);
      const { error } = await adm.from("strava_akun").upsert({
        siswa_id: sis.id, athlete_id: ath.id, nama, access_token: t.access_token, refresh_token: t.refresh_token,
        expires_at: t.expires_at, terhubung_pada: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      const webhook = await pastikanWebhook().catch(() => "gagal");
      const akun = await akunDari(sis);
      const baru = akun ? await sinkron(sis, akun) : 0;
      return json({ ok: true, nama, baru, webhook });
    }
    const akun = await akunDari(sis);
    if (b.aksi === "sinkron") {
      if (!akun) return json({ error: "Strava belum terhubung." }, 400);
      return json({ ok: true, baru: await sinkron(sis, akun) });
    }
    if (b.aksi === "putus") {
      if (akun) {
        const tok = await aksesToken(akun).catch(() => akun.access_token);
        await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: "Bearer " + tok } }).catch(() => null);
        await adm.from("strava_akun").delete().eq("siswa_id", sis.id);
      }
      return json({ ok: true });
    }
    return json({ error: "aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Gagal" }, 500);
  }
});
