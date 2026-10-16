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
2. Isi nama proyek (misalnya `monitor-kko`), buat password database (simpan baik-baik), dan pilih region **Southeast Asia (Singapore)**.
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
3. Isi nama proyek, misalnya `monitor-kko`. Nama ini menjadi alamat web: `monitor-kko.pages.dev`.
4. Seret **folder** ini (berisi `index.html`) ke kotak unggah, lalu klik **Deploy site**.
5. Setelah selesai, web bisa dibuka di `https://monitor-kko.pages.dev`.

**Memperbarui web:** buka proyek di Workers & Pages, klik **Create a new deployment**, lalu seret lagi folder yang sudah diperbarui.

**Domain sendiri (opsional):** di proyek, buka tab **Custom domains**, lalu klik **Set up a custom domain**.
- Kalau domain Anda dikelola di Cloudflare, pengaturannya otomatis.
- Kalau memakai subdomain sekolah atau kampus (misalnya `monitoring.namasekolah.sch.id`), minta pengelola IT menambahkan **CNAME** yang mengarah ke `monitor-kko.pages.dev`.

## 4. Atur alamat web di Supabase

Langkah ini diperlukan agar tautan konfirmasi email dan lupa kata sandi kembali ke web Anda.

1. Buka Supabase **Authentication → URL Configuration**.
2. Isi **Site URL** dengan alamat web Anda, misalnya `https://monitor-kko.pages.dev`.
3. Tambahkan alamat yang sama di **Redirect URLs**.

## 5. Jadikan akun Anda pengelola

1. Buka web Anda, klik **Belum punya akun? Daftar**, lalu daftar dengan email Anda.
2. Buka email konfirmasi dan klik tautannya.
3. Di Supabase **SQL Editor**, jalankan perintah ini (ganti emailnya):

```sql
update public.profil set role = 'admin' where email = 'email-anda@contoh.com';
```

4. Masuk ke web. Anda sekarang berperan sebagai **Pengelola**.

## 6. Menambahkan pelatih dan pengamat

1. Minta mereka membuka web dan **Daftar** dengan email masing-masing.
2. Setelah mereka konfirmasi email, buka tab **Pengguna**. Akun baru muncul di urutan teratas dengan status *menunggu*.
3. Pilih perannya, lalu klik **Simpan**:
   - **Pelatih**: pilih juga cabor yang dipegang.
   - **Pengamat** (orang tua, manajer tim, guru, dokter tim): hanya bisa melihat.

Peran diterapkan langsung di database. Pelatih tidak bisa membaca data atlet di luar cabornya, dan pengamat tidak bisa mengubah data, meskipun mencoba lewat cara lain.

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

## Hal penting lain

- **Proyek gratis bisa dijeda.** Di paket gratis Supabase, proyek yang tidak dipakai beberapa hari bisa dijeda otomatis. Cukup buka dashboard Supabase dan klik *Restore*. Kalau web dipakai setiap hari, ini jarang terjadi.
- **Cadangan data.** Gunakan tombol **Unduh CSV** (Ringkasan tim dan Tes fisik) secara berkala. Supabase juga menyediakan ekspor data di **Database → Backups**.
- **Data contoh.** Sebelum ada atlet yang didaftarkan, dashboard menampilkan 14 atlet contoh. Data contoh itu otomatis hilang begitu atlet pertama ditambahkan.
- **Mode contoh.** Kalau `index.html` dibuka tanpa konfigurasi, web berjalan dalam mode contoh, berguna untuk demonstrasi.
- **Atlet di bawah umur.** Data atlet di bawah 18 tahun termasuk data pribadi anak. Pastikan ada izin orang tua (dan sekolah/klub bila perlu), serta berikan akses hanya kepada pelatih dan guru yang berhak.
