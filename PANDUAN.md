# Panduan Pemasangan — Monitoring Latihan Atlet

Isi folder:

- `index.html` — aplikasi pelatih / pengelola.
- `atlet.html` — halaman isian harian untuk atlet (dibuka lewat tautan pribadi).
- `config.js` — alamat dan kunci database.
- `norma.js` — norma tes kondisi fisik (dipakai halaman pelatih dan atlet).
- `kesiapan.js` — rumus skor kesiapan harian.
- `impor.js` — pembaca file aktivitas dari jam dan Strava.
- `acwr.js` — zona risiko ACWR, kartu risiko, dan kurva beban–performa–cedera.
- `sw.js`, `manifest*.json`, `icon-*.png` — agar web bisa dipasang seperti aplikasi.
- `setup.sql` — skema database dan aturan akses.
- `PANDUAN.md` — panduan ini.

Waktu pemasangan sekitar 20–30 menit. Semua layanan di bawah punya paket gratis.

---

## 1. Buat database di Supabase

1. Buka **supabase.com**, daftar, lalu klik **New project**.
2. Isi nama proyek (misalnya `monitoring-latihan-atlet`), buat password database (simpan baik-baik), dan pilih region **Southeast Asia (Singapore)**.
3. Tunggu sampai proyek siap (±2 menit).
4. Buka menu **SQL Editor** → **New query**.
5. Tempel seluruh isi `setup.sql`, lalu klik **Run**. Pastikan muncul pesan *Success*.

## 2. Hubungkan aplikasi ke database

1. Di Supabase buka **Project Settings → API**.
2. Salin **Project URL** dan **anon public key**.
3. Buka `config.js` dengan Notepad atau VS Code, lalu isi:

```js
window.MONITOR_CONFIG={
  supabaseUrl:"https://xxxxxxxx.supabase.co",
  supabaseAnonKey:"eyJhbGciOi..."
};
```

4. Simpan file.

> **Anon key** memang dirancang untuk ditaruh di halaman web, karena data dilindungi aturan akses di database.
> **Jangan pernah** menaruh *service_role key* di file ini.

## 3. Pasang web di internet (Cloudflare Pages)

1. Daftar atau masuk di **dash.cloudflare.com**.
2. Buka menu **Workers & Pages**, klik **Create application**, lalu **Get started** dan pilih **Drag and drop your files**.
3. Isi nama proyek, misalnya `monitoring-latihan-atlet`. Nama ini menjadi alamat web: `monitoring-latihan-atlet.pages.dev`.
4. Seret **folder** ini (berisi `index.html`) ke kotak unggah, lalu klik **Deploy site**.
5. Setelah selesai, web bisa dibuka di `https://monitoring-latihan-atlet.pages.dev`.

**Memperbarui web:** buka proyek di Workers & Pages, klik **Create a new deployment**, lalu seret lagi folder yang sudah diperbarui.

**Domain sendiri (opsional):** di proyek, buka tab **Custom domains**, lalu klik **Set up a custom domain**.
- Kalau domain Anda dikelola di Cloudflare, pengaturannya otomatis.
- Kalau memakai subdomain sekolah atau kampus (misalnya `monitoring.namasekolah.sch.id`), minta pengelola IT menambahkan **CNAME** yang mengarah ke `monitoring-latihan-atlet.pages.dev`.

## 4. Atur alamat web di Supabase

Langkah ini diperlukan agar tautan konfirmasi email dan lupa kata sandi kembali ke web Anda.

1. Buka Supabase **Authentication → URL Configuration**.
2. Isi **Site URL** dengan alamat web Anda, misalnya `https://monitoring-latihan-atlet.pages.dev`.
3. Tambahkan alamat yang sama di **Redirect URLs**.

## 5. Ruang kerja per akun (data Anda tidak terlihat akun lain)

1. Buka web Anda, klik **Belum punya akun? Daftar**, lalu daftar dengan email Anda dan konfirmasi lewat email.
2. Setelah masuk, Anda langsung punya **ruang kerja sendiri**. Atlet yang Anda tambahkan **hanya terlihat oleh Anda** dan orang yang Anda undang.
3. Siapa pun yang mendaftar kemudian — misalnya pelatih lain — juga mendapat ruang kerja sendiri yang **kosong**. Mereka **tidak bisa** membaca, mengubah, menghapus, atau memindahkan atlet Anda. Aturan ini dijalankan di database, jadi tetap berlaku meskipun seseorang mencoba lewat cara lain.
4. Saat ruang kerja masih kosong, dashboard menampilkan 14 atlet **contoh (fiktif)**, bukan data milik akun lain.
5. (Opsional) Jadikan akun Anda **pengelola platform** agar bisa menonaktifkan akun yang menyalahgunakan web. Pengelola **tetap tidak bisa** melihat atlet milik akun lain. Di Supabase **SQL Editor** jalankan:

```sql
update public.profil set role = 'admin' where email = 'email-anda@contoh.com';
```

## 6. Mengajak asisten pelatih atau pengamat

1. Minta orang tersebut **mendaftar** dulu di web dengan emailnya.
2. Buka tab **Tim & akses** → **Undang anggota tim**: isi emailnya, pilih peran, dan (opsional) batasi ke cabor tertentu.
   - **Asisten pelatih**: melihat dan mengisi data atlet Anda (hanya cabor yang Anda pilih).
   - **Pengamat** (orang tua, manajer tim, guru, dokter tim): hanya melihat.
3. Orang itu membuka tab **Tim & akses** miliknya lalu menekan **Terima**. Akses baru berlaku setelah diterima.
4. Akses bisa dicabut kapan saja lewat **Cabut akses**. Anggota juga bisa **Keluar dari tim**.
5. Atlet yang ditambahkan anggota akan masuk ke ruang kerja anggota itu sendiri, bukan ke ruang kerja Anda.

**Memperbarui dari versi lama:** saat `setup.sql` versi ini dijalankan pertama kali, semua atlet lama otomatis menjadi milik akun **pengelola pertama** (Anda), dan pelatih/pengamat yang sebelumnya Anda setujui otomatis menjadi anggota tim Anda dengan akses yang sama seperti sebelumnya.

## 7. Supaya sepenuhnya tampil atas nama program Anda

- **Email.** Email konfirmasi dan atur ulang kata sandi dikirim dari pengirim bawaan Supabase, dan jumlahnya dibatasi per jam.
  - Untuk mengganti pengirim menjadi alamat Anda, atur SMTP sendiri di **Authentication → SMTP Settings**. Bisa memakai email sekolah, Gmail dengan App Password, atau layanan seperti Brevo.
  - Ubah juga isi email di **Authentication → Email Templates** ke Bahasa Indonesia.
- **Nama web.** Nama dan teks web bisa diubah langsung di `index.html`, misalnya judul *Monitoring Latihan Atlet*.

## 8. Fitur ala TrainingPeaks / intervals.icu

- **Kalender latihan.** Tab *Kalender latihan* menampilkan satu bulan per atlet, dengan kolom *Ringkasan minggu* (TSS aktual / rencana, durasi, fitness, form, ramp rate).
  - Pelatih dan pengelola klik sebuah hari untuk menambah rencana sesi: jenis, judul, durasi, target RPE, dan deskripsi. Bisa juga memakai *Templat cepat*.
  - Centang **Terapkan juga ke semua atlet …** untuk memberi sesi yang sama ke satu cabor sekaligus.
  - Kartu rencana bisa **diseret** ke hari lain. Tombol **Salin rencana ke minggu depan** menyalin satu minggu.
  - Pengamat hanya bisa melihat.
- **Kepatuhan rencana.** Warna kartu rencana dihitung dari TSS aktual ÷ TSS rencana: hijau 80–120%, kuning 50–79% atau 121–150%, oranye di luar itu, merah jika tidak dilakukan.
- **Input harian** menampilkan rencana pelatih untuk hari itu. Tombol **Isi sesuai rencana** mengisi durasi, RPE, dan jenis latihan. Ada juga kolom opsional *denyut nadi istirahat* dan *HRV* pagi.
- **Dashboard atlet** kini menampilkan:
  - Fitness (CTL), fatigue (ATL), form (TSB), ramp rate, TSS 7 hari, dan persentase kepatuhan.
  - Proyeksi fitness/form dari rencana ke depan (garis putus-putus).
  - Beban mingguan per jenis latihan.
  - Tren wellness, nadi istirahat, dan HRV.

**Memperbarui database lama:** jika sebelumnya sudah memasang versi lama, jalankan ulang seluruh `setup.sql` di SQL Editor. Skrip ini aman dijalankan ulang karena tidak menghapus data, hanya menambah tabel `rencana` dan kolom baru di `entri`.

## 9. Atlet mengisi sendiri, aplikasi di HP, dan beberapa sesi per hari

- **Tautan pribadi atlet.** Di tab *Data atlet*, tekan **Tautan** di baris atlet. Salin atau kirim lewat WhatsApp.
  - Atlet membuka tautan itu di HP, tanpa daftar dan tanpa kata sandi.
  - Atlet mengisi **kondisi pagi** dan **sesi latihan**, melihat rencana pelatih, dan melihat beban 7 hari terakhir.
  - Tautan hanya bisa membaca dan mengisi data atlet itu sendiri. Jika tautan tersebar, tekan **Buat tautan baru**; tautan lama langsung tidak berlaku.
  - **Salin semua tautan atlet di cabor ini** memudahkan pembagian ke satu tim.
- **Dashboard atlet.** Di halaman atlet ada dua tab: **Isi hari ini** dan **Dashboard**. Dashboard menampilkan:
  - kesiapan hari ini (siap latihan / waspada / perlu pemulihan),
  - fitness, fatigue, form, ramp rate, beban 7 hari, dan persentase sesuai rencana,
  - grafik fitness & kelelahan serta form, termasuk perkiraan dari rencana pelatih,
  - beban mingguan per jenis latihan, tren kondisi pagi, nadi istirahat, dan HRV,
  - hasil tes fisik terakhir dengan skala norma dan perubahan dari tes sebelumnya,
  - profil (usia, BB, TB, BMI) dan zona denyut jantung.
  Atlet hanya melihat datanya sendiri.
- **Pasang seperti aplikasi.** Di Android (Chrome), ketuk **Pasang aplikasi** atau menu ⋮ → *Tambahkan ke layar utama*. Di iPhone (Safari), ketuk *Bagikan* → *Tambahkan ke Layar Utama*. Atlet memasang dari tautan pribadinya; setelah itu ikon *Latihan Saya* langsung membuka halamannya.
- **Saat sinyal lemah.** Halaman atlet tetap terbuka dan isian disimpan di HP, lalu terkirim otomatis saat online. Aplikasi pelatih juga tetap terbuka, tetapi butuh internet untuk memuat dan menyimpan data.
- **Beberapa sesi per hari.** Kondisi pagi diisi sekali sehari, sedangkan sesi latihan bisa ditambahkan berkali-kali (misalnya pagi dan sore). Beban harian, ACWR, fitness, dan kalender menjumlahkan semua sesi. Entri lama otomatis terbaca sebagai satu sesi.

## 10. Kesiapan, pengingat, laporan, dan impor dari jam

- **Skor kesiapan 0–100.** Dihitung setiap kali atlet mengisi kondisi pagi:
  - kondisi pagi dibanding kebiasaan atlet sendiri (40%),
  - form latihan (25%),
  - HRV (20%) dan nadi istirahat (15%) dibanding rata-rata 4 minggu, bila diisi,
  - dikurangi 4 poin per angka nyeri.
  ≥70 **siap latihan**, 50–69 **waspada**, <50 **perlu pemulihan**. Tampil di daftar prioritas (kolom *Siap*), profil atlet, dashboard atlet, laporan, dan halaman atlet. Rumusnya ada di `kesiapan.js` dan ambangnya perlu dikalibrasi dengan pengalaman pelatih.
- **Pengingat & peringatan** (tab *Ringkasan tim*):
  - kotak merah berisi atlet yang perlu tindakan, beserta alasannya (klik nama untuk membuka profil);
  - daftar atlet yang **belum mengisi kondisi pagi hari ini**, dengan tombol **Kirim pengingat ke grup WhatsApp** dan **Salin daftar**;
  - tombol **WA** di samping nama atlet yang nomor WhatsApp-nya diisi di *Data atlet*. Pesannya sudah berisi tautan pribadi atlet;
  - angka merah di tab *Ringkasan tim* menunjukkan jumlah atlet berstatus merah.
- **Laporan mingguan.** Di *Dashboard atlet*, tekan **Laporan mingguan**, pilih minggu, pilih atlet ini saja atau semua atlet satu cabor, tulis catatan pelatih, lalu **Tampilkan laporan** → **Cetak / simpan PDF**. Isinya: ringkasan minggu, grafik beban harian dibanding rencana, tabel per hari (rencana, latihan, TSS, wellness, nyeri, kesiapan), status terkini, dan catatan pelatih.
- **Impor dari jam / Strava.** Tombol **⌚ Impor dari jam / Strava** ada di *Input harian* (pelatih) dan di halaman atlet.
  - Format yang dibaca: file **.fit** (Garmin, Coros, Polar, Suunto, Wahoo), **.gpx**, **.tcx**, versi **.gz**-nya, **activities.csv** dari ekspor data Strava, dan **Activities.csv** dari Garmin Connect.
  - Durasi, rata-rata dan maksimal denyut jantung, jarak, dan jenis latihan terisi otomatis. RPE **disarankan** dari denyut jantung (% HRmax menurut usia) dan sebaiknya disesuaikan dengan rasa atlet.
  - File berisi banyak aktivitas (CSV Strava/Garmin) ditampilkan sebagai daftar untuk dipilih. Aktivitas yang sudah pernah diimpor otomatis dilewati.
  - Atlet hanya bisa mengimpor aktivitas 7 hari terakhir; pelatih bisa mengimpor tanggal berapa pun.
  - File dibaca langsung di HP/komputer dan tidak diunggah ke mana pun.
  - Cara mendapat file: Garmin Connect → aktivitas → ⚙ → *Ekspor Asli* (.fit) atau *Ekspor GPX*; Strava → aktivitas → ⋯ → *Ekspor GPX*, atau Pengaturan → *Akun Saya* → *Unduh atau hapus akun Anda* → *Minta arsip* (berisi activities.csv).

## 11. Untuk umum dan zona risiko ACWR

- **Untuk semua atlet.** Aplikasi bisa dipakai klub, sekolah, akademi, maupun atlet perorangan. Kolom *Tim / kelompok* bebas diisi (misalnya *Tim U-17*, *Klub A*, *Senior*). Peran **Pengamat** cocok untuk orang tua, manajer tim, guru, atau dokter tim — hanya bisa melihat.
- **Zona risiko cedera (ACWR)** mengikuti Gabbett (2016):

  | ACWR | Zona | Arti |
  |---|---|---|
  | < 0,80 | Underload (biru) | beban terlalu rendah, risiko penurunan kondisi |
  | 0,80–1,29 | Optimal (hijau) | risiko cedera rendah |
  | 1,30–1,49 | Risiko meningkat (oranye) | risiko cedera ±2–3× lebih tinggi |
  | ≥ 1,50 | Zona bahaya (merah) | risiko cedera ±4–5× lebih tinggi |

- **Beban harian & ACWR** (Dashboard atlet dan halaman atlet): batang = beban harian, garis biru = ACWR dengan garis batas 0,8 / 1,0 / 1,3 / 1,5.
- **Kurva beban–performa–cedera**: posisi atlet (★) pada kurva performa dan risiko cedera. Di *Ringkasan tim* semua atlet tampil sebagai bulatan berinisial, beserta jumlah atlet di tiap zona.
- **Perubahan beban mingguan**: kenaikan beban dibanding minggu lalu; usahakan ≤ 10–15% per minggu.

**Wajib:** setelah memperbarui ke versi ini, jalankan ulang seluruh `setup.sql` di Supabase. Skrip ini menambah kode tautan atlet, kolom `sesi`, dan dua fungsi khusus halaman atlet.

## 12. Fitness, fatigue, form %, dan ACWR dalam satu model

- **Fitness (CTL)** = rata-rata beban 42 hari, **Fatigue (ATL)** = rata-rata beban 7 hari (rata-rata berbobot eksponensial).
- **Form %** = (Fitness − Fatigue) ÷ Fitness × 100, seperti intervals.icu. Zona: **Transisi** > +20% · **Segar** +5…+20% · **Zona abu-abu** −10…+5% · **Optimal** −30…−10% · **Risiko tinggi** < −30%.
- **ACWR EWMA** = Fatigue ÷ Fitness = 1 − Form%/100. Jadi Form −30% ≈ ACWR 1,3 dan Form −50% = ACWR 1,5 — zona Form % dan zona ACWR Gabbett saling cocok.
- **Status gabungan** memakai zona **paling waspada** dari ACWR rolling 7:28 dan ACWR EWMA; dipakai untuk status merah/kuning, kartu risiko cedera, skor kesiapan, kalender, dan laporan.
- Form % baru dinilai setelah **≥ 4 minggu data** dan Fitness ≥ 10. Sebelum itu tertulis *data belum cukup* — karena saat Fitness masih kecil (misalnya 3), Form absolut −13 bisa terlihat "optimal" padahal sebenarnya lonjakan besar.
- Fitness dan fatigue diawali dari **rata-rata beban harian 4 minggu pertama**, bukan dari 0, agar atlet baru tidak mendapat peringatan palsu "zona bahaya".

## 13. Peringatan otomatis dan monotony–strain

**Susunan tab Ringkasan tim.** Dari atas ke bawah:
1. **Strip angka**: Segera ditangani · Perlu dipantau · Aman · Sudah isi kondisi pagi. Klik angkanya untuk menyaring daftar atlet.
2. **Perlu perhatian hari ini**: daftar tindakan. Yang "segera" selalu tampil, yang "pantau" bisa dibuka. Di bawahnya ada pengingat *Belum mengisi kondisi pagi* dengan tombol WhatsApp.
3. **Semua atlet**: tabel status, kesiapan, ACWR, wellness, dan tren 14 hari. Klik nama untuk profil.
4. **Analisis tim** dalam tab: Risiko · ACWR per atlet · Kurva beban–cedera · Tren tim · Peta wellness · Per cabor.
5. **Cara membaca status & ambang**, bisa dibuka bila perlu.

Status atlet (merah/kuning/hijau), angka di strip, dan daftar perhatian memakai **satu aturan yang sama**, jadi angkanya selalu konsisten.

**Perlu perhatian hari ini.** Daftar ini ada di tab **Ringkasan tim**. Daftar yang sama muncul sebagai jendela **sekali sehari** saat aplikasi pertama kali dibuka. Jumlahnya juga tampil sebagai angka merah di tab Ringkasan tim.

| Tanda | Kapan muncul | Tingkat |
|---|---|---|
| ACWR ≥ 1,5 | ACWR rolling atau EWMA di zona bahaya | Segera |
| Kesiapan < 50 | Skor kesiapan hari ini di bawah 50 | Segera |
| Nyeri | Nyeri naik dibanding entri sebelumnya (≥ 3); nyeri ≥ 6 atau ≥ 3 tiga entri berturut-turut | Pantau / segera |
| Monoton / strain | Monotony > 2, strain ≥ 1,5× biasanya, atau keduanya (segera) | Pantau / segera |
| Belum mengisi | Tidak mengisi kondisi pagi ≥ 3 hari, atau belum pernah | Pantau |

Klik chip untuk menyaring, klik nama untuk membuka profil, tombol **WA** untuk menghubungi atlet (pesannya sudah berisi tautan pribadi), atau **Salin daftar** / **Kirim daftar ke WhatsApp** untuk dibagikan ke tim pelatih.

**Monotony dan strain (Foster).**
- **Monotony** = rata-rata beban harian 7 hari ÷ simpangan bakunya (hari istirahat dihitung 0). Di atas **2,0** berarti latihan monoton: bebannya hampir sama setiap hari dan kurang hari ringan.
- **Strain** = beban 7 hari × monotony. Karena satuan TSS berbeda dari sRPE, strain dibandingkan dengan **rata-rata strain atlet itu sendiri selama 12 minggu** (muncul setelah ±4 minggu data).
- Monotony > 2 **bersamaan** dengan strain ≥ 1,25× biasanya membuat status atlet **merah**, karena kombinasi ini paling sering mendahului sakit dan overtraining.
- Grafik dan kartunya ada di tab **Dashboard atlet** dan di dashboard aplikasi atlet (*Variasi latihan*).

## 14. Sinkron otomatis dari jam (intervals.icu — gratis)

Jam **Garmin, Coros, Polar, Suunto, dan Wahoo** disambungkan atlet ke **intervals.icu** (gratis). Atlet lalu menempelkan **API key** intervals.icu **sekali** di halaman pribadinya. Setelah itu latihan dari jam masuk sendiri ke aplikasi ini, tanpa unggah file.

Jam harus disambungkan **langsung** ke intervals.icu. Aktivitas yang masuk ke intervals.icu **dari Strava** tidak boleh diteruskan lewat API, jadi tidak ikut masuk.

**Persiapan pelatih (sekali saja, lebih mudah di laptop):**

1. **Perbarui database.** Jalankan ulang `setup.sql` di Supabase → SQL Editor (aman untuk data yang sudah ada).
2. **Pasang fungsi server.** Buka Supabase → **Edge Functions → Deploy a new function → Via Editor**. Beri nama persis `intervals`. Hapus contoh kodenya, lalu tempel seluruh isi file
   https://raw.githubusercontent.com/Monitoring-Latihan-Atlet/monitoring-latihan-atlet.github.io/main/supabase/functions/intervals/index.ts
   dan klik **Deploy**.
3. **Matikan pemeriksaan JWT.** Buka fungsi `intervals` → **Details/Settings**, matikan **Enforce JWT Verification** (Verify JWT), lalu **Save**. Keamanan tetap terjaga: fungsi hanya menerima kode atlet yang sah atau login pelatih, dan API key disimpan di tabel yang tidak bisa dibaca dari aplikasi.
4. Selesai. Kotak **Sinkron otomatis dari jam** muncul di halaman pribadi atlet (tab *Isi hari ini*, bagian *Sesi latihan*).

**Kapan data ditarik:** setiap kali atlet membuka halamannya dan setiap kali pelatih membuka aplikasi (paling sering tiap 30 menit), atau saat tombol **Sinkronkan sekarang** ditekan.

**(Opsional) sinkron tiap jam walau tidak ada yang membuka aplikasi:**
1. Buka **Edge Functions → Secrets** dan tambahkan `CRON_SECRET` = kata acak bebas.
2. Buka **Integrations → Cron** (aktifkan bila diminta) → **Create job**:
   - Nama: `sinkron-jam`
   - Jadwal: `0 * * * *` (tiap jam)
   - Jenis: **Supabase Edge Function**, metode **POST**, fungsi `intervals`
   - Header: `x-cron-secret` = nilai `CRON_SECRET` tadi
   - Body: `{"aksi":"sinkron_semua"}`

**Langkah untuk atlet (petunjuknya juga ada di aplikasi):**
1. Daftar gratis di https://intervals.icu.
2. Buka **Settings → Connections**, lalu sambungkan jamnya (Garmin Connect, Coros, Polar, Suunto, atau Wahoo).
3. Buka **Settings → Developer Settings**, tekan **Generate** pada *API Key*, lalu salin.
4. Buka tautan pribadi dari pelatih → *Isi hari ini* → tempel API key → **Hubungkan**.

**Yang terjadi setelah tersambung:**
- Latihan 7 hari terakhir langsung diambil.
- **RPE** memakai RPE yang diisi atlet di intervals.icu bila ada. Bila tidak, RPE ditebak dari denyut jantung (% HRmax) dan ditandai **(tebakan)**. Atlet bisa mengubahnya langsung dari daftar sesi.
- Aktivitas yang sudah diimpor manual dari file jam tidak dobel.
- Pelatih melihat tanda **Jam (intervals.icu) ✓** di tab **Data atlet**. Sesinya diberi label "Jam (intervals.icu)".
- Atlet bisa **Putuskan** kapan saja. Latihan yang sudah masuk tetap tersimpan.

### 14b. (Opsional, berbayar) Sinkron lewat Strava

Sejak Juni 2026, membuat aplikasi API Strava **memerlukan langganan Strava** pada akun pelatih (sekitar US$79,99 per tahun). Aplikasi baru bisa dipakai hingga 10 atlet tanpa ditinjau Strava. Fungsi `strava` sudah tersedia bila suatu saat ingin dipakai.

**Persiapan pelatih (sekali saja, lebih mudah di laptop):**

1. **Perbarui database.** Jalankan ulang `setup.sql` di Supabase → SQL Editor (aman untuk data yang sudah ada).
2. **Daftarkan aplikasi di Strava.** Masuk ke https://www.strava.com/settings/api dengan akun Strava Anda, lalu isi:
   - *Application Name*: `Monitoring Latihan Atlet`
   - *Category*: `Training`
   - *Website*: `https://monitoring-latihan-atlet.github.io`
   - *Authorization Callback Domain*: `monitoring-latihan-atlet.github.io` (tanpa `https://`)
   - Unggah logo (boleh `icon-512.png` dari repositori ini), centang persetujuan, lalu **Create**. Catat **Client ID** dan **Client Secret**.
3. **Pasang fungsi server di Supabase.** Buka **Edge Functions → Deploy a new function → Via Editor**. Beri nama persis `strava`. Hapus contoh kodenya, lalu tempel seluruh isi file
   https://raw.githubusercontent.com/Monitoring-Latihan-Atlet/monitoring-latihan-atlet.github.io/main/supabase/functions/strava/index.ts
   dan klik **Deploy**.
4. **Matikan pemeriksaan JWT** untuk fungsi itu: buka fungsi `strava` → **Details/Settings**, matikan **Enforce JWT Verification** (Verify JWT), lalu **Save**. Ini diperlukan karena Strava mengirim data ke fungsi ini tanpa login Supabase. Keamanan tetap terjaga: fungsi hanya menerima kode atlet yang sah, dan token Strava disimpan di tabel yang tidak bisa dibaca dari aplikasi.
5. **Isi rahasia.** Buka **Edge Functions → Secrets** dan tambahkan:
   - `STRAVA_CLIENT_ID` = Client ID dari langkah 2
   - `STRAVA_CLIENT_SECRET` = Client Secret dari langkah 2
   - `STRAVA_VERIFY_TOKEN` = kata acak bebas, misalnya `mla-webhook-` diikuti 8 huruf/angka acak

   **Client Secret jangan pernah ditaruh di `config.js` atau dikirim lewat chat.**
6. Selesai. Tombol **Hubungkan dengan Strava** otomatis muncul di halaman pribadi atlet (tab *Isi hari ini*, bagian *Sesi latihan*).

**Yang terjadi setelah atlet terhubung:**
- Latihan 7 hari terakhir langsung diambil. Latihan baru masuk otomatis lewat *webhook* Strava, yang didaftarkan sendiri oleh fungsi saat atlet pertama terhubung. Saat atlet membuka aplikasinya, sinkron juga dicek ulang.
- **RPE**: bila atlet mengisi *Perceived Exertion* di Strava, nilai itu yang dipakai. Bila tidak, RPE ditebak dari denyut jantung rata-rata (% HRmax) dan ditandai **(tebakan)**. Atlet bisa mengubah RPE langsung dari daftar sesi.
- Aktivitas yang sudah diimpor manual dari file jam tidak dobel. Aktivitas yang dihapus di Strava ikut terhapus.
- Pelatih melihat tanda **Strava ✓** di tab **Data atlet**. Sesi dari Strava diberi label "Strava".
- Atlet bisa **Putuskan** kapan saja. Latihan yang sudah masuk tetap tersimpan.

**Batas dari Strava:** aplikasi Strava yang baru dibuat biasanya hanya boleh dihubungkan oleh **1 atlet** (pemilik aplikasi). Untuk banyak atlet, ajukan penambahan kuota lewat formulir *Developer Program* di halaman https://www.strava.com/settings/api. Sambil menunggu, atlet lain tetap bisa memakai **Impor dari file jam**. Patuhi juga ketentuan API Strava, termasuk meminta persetujuan atlet sebelum datanya dilihat pelatih.

## 15. Ekspor PDF / CSV untuk satu atlet atau banyak atlet

Tombol **Ekspor PDF / CSV** ada di tab **Ringkasan tim** dan **Dashboard atlet**. Tombol **Unduh CSV** juga membuka jendela yang sama.

**1. Pilih atlet.** Ada tiga cara:
- **Semua** atlet;
- satu atau beberapa **cabor**: klik chip cabor, klik lagi untuk membatalkan;
- centang **satu per satu**, dibantu kolom pencarian nama.

**2. Pilih jenis ekspor:**

| Jenis | Isi | Cocok untuk |
|---|---|---|
| **PDF laporan + statistik gabungan** | Ringkasan, daftar perlu perhatian, tabel atlet, statistik deskriptif (n, rata-rata, SD, min, median, maks) untuk indikator, profil, per cabor, dan tes fisik (termasuk sebaran skala 1–5), serta semua grafik analisis untuk **atlet terpilih saja** | Laporan ke pimpinan, rapat tim |
| **PDF dashboard per atlet** | 3 halaman per atlet: angka utama, grafik, statistik 28 hari, dan tes fisik terakhir. Banyak atlet tergabung dalam satu PDF | Arsip per atlet, laporan ke orang tua |
| **CSV ringkasan per atlet** | 1 baris per atlet: status, kesiapan, ACWR, EWMA, form, fitness, fatigue, monotony, strain, wellness, z, beban, kepatuhan, rata-rata 28 hari, dan hasil serta skala setiap tes fisik | Analisis statistik di Excel / SPSS (perbandingan antar atlet) |
| **CSV data harian** | 1 baris per atlet per hari, dengan rentang 28 hari, 90 hari, 1 tahun, atau semua data | Analisis tren dan penelitian |

**Menyimpan PDF:** di jendela cetak, pilih **Simpan sebagai PDF** dan centang **Grafik latar belakang** (*Background graphics*). Di HP Android: menu ⋮ → Bagikan → Cetak → Simpan sebagai PDF.

**CSV:** angka memakai titik desimal, cocok untuk SPSS. Di Excel berbahasa Indonesia, gunakan **Data → Dari Teks/CSV** agar kolom terbaca benar.

## Hal penting lain

- **Proyek gratis bisa dijeda.** Di paket gratis Supabase, proyek yang tidak dipakai beberapa hari bisa dijeda otomatis. Cukup buka dashboard Supabase dan klik *Restore*. Kalau web dipakai setiap hari, ini jarang terjadi.
- **Cadangan data.** Gunakan tombol **Unduh CSV** (Ringkasan tim dan Tes fisik) secara berkala. Supabase juga menyediakan ekspor data di **Database → Backups**.
- **Data contoh.** Sebelum ada atlet yang didaftarkan, dashboard menampilkan 14 atlet contoh. Data contoh itu otomatis hilang begitu atlet pertama ditambahkan.
- **Mode contoh.** Kalau `index.html` dibuka tanpa konfigurasi, web berjalan dalam mode contoh, berguna untuk demonstrasi.
- **Atlet di bawah umur.** Data atlet di bawah 18 tahun termasuk data pribadi anak. Pastikan ada izin orang tua (dan sekolah/klub bila perlu), serta berikan akses hanya kepada pelatih dan guru yang berhak.
