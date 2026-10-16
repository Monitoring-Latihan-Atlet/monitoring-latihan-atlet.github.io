-- =====================================================================
-- Monitoring Latihan Atlet — skema database
-- Jalankan di Supabase: SQL Editor → New query → tempel → Run.
-- Aman dijalankan ulang; jalankan lagi setiap kali aplikasi diperbarui.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Pengguna & peran ----------
create table if not exists public.profil (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nama text,
  role text not null default 'menunggu' check (role in ('admin','pelatih','guru','menunggu')),
  cabor text[] not null default '{}',
  dibuat timestamptz not null default now()
);

-- Setiap akun baru otomatis mendapat baris profil dan ruang kerja sendiri (peran "pelatih").
-- Akun baru TIDAK bisa melihat atlet milik akun lain; akses hanya lewat undangan pemilik.
alter table public.profil alter column role set default 'pelatih';
create or replace function public.buat_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (id, email, nama)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nama', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.buat_profil();

-- Fungsi bantu untuk aturan akses
create or replace function public.peran_saya() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profil where id = auth.uid()
$$;
create or replace function public.cabor_saya() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(cabor, '{}') from public.profil where id = auth.uid()
$$;

-- ---------- Data siswa ----------
create table if not exists public.siswa (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  cabor text not null,
  kelas text,
  jk text check (jk in ('L','P')),
  pelatih text,
  tgl_lahir date,
  bb numeric,
  tb numeric,
  dibuat timestamptz not null default now()
);

-- Kode rahasia untuk tautan pribadi atlet (atlet.html?k=<kode>)
alter table public.siswa add column if not exists kode uuid not null default gen_random_uuid();
create unique index if not exists siswa_kode_idx on public.siswa (kode);
-- Nomor WhatsApp atlet (opsional) untuk tombol pengingat
alter table public.siswa add column if not exists hp text;

-- ---------- Kepemilikan: setiap atlet milik satu akun (ruang kerja) ----------
alter table public.siswa add column if not exists pemilik uuid references auth.users(id) on delete cascade;
alter table public.siswa alter column pemilik set default auth.uid();
create index if not exists siswa_pemilik_idx on public.siswa (pemilik);

-- Anggota tim: pemilik mengundang akun lain sebagai asisten pelatih atau pengamat.
create table if not exists public.akses (
  pemilik uuid not null references auth.users(id) on delete cascade,
  anggota uuid not null references auth.users(id) on delete cascade,
  peran text not null default 'pengamat' check (peran in ('pelatih','pengamat')),
  cabor text[] not null default '{}',          -- kosong = semua cabor milik pemilik
  dibuat timestamptz not null default now(),
  primary key (pemilik, anggota),
  check (pemilik <> anggota)
);
create index if not exists akses_anggota_idx on public.akses (anggota);
-- Undangan baru berlaku setelah diterima oleh akun yang diundang.
alter table public.akses add column if not exists diterima boolean not null default false;

-- Migrasi satu kali dari versi lama (satu organisasi) ke ruang kerja per akun.
create table if not exists public._migrasi (nama text primary key, waktu timestamptz not null default now());
alter table public._migrasi enable row level security;
do $$
declare adm uuid;
begin
  if not exists (select 1 from public._migrasi where nama = 'ruang_kerja_v1') then
    select id into adm from public.profil where role = 'admin' order by dibuat limit 1;
    if adm is not null then
      -- semua atlet lama menjadi milik pengelola pertama
      update public.siswa set pemilik = adm where pemilik is null;
      -- pelatih & guru yang sudah disetujui menjadi anggota tim pengelola (aksesnya tidak berubah)
      insert into public.akses (pemilik, anggota, peran, cabor)
        select adm, p.id, case when p.role = 'guru' then 'pengamat' else 'pelatih' end,
               case when p.role = 'pelatih' then coalesce(p.cabor, '{}') else '{}' end
        from public.profil p where p.role in ('pelatih','guru') and p.id <> adm
        on conflict (pemilik, anggota) do nothing;
      update public.akses set diterima = true where pemilik = adm;
    end if;
    -- akun guru & yang masih menunggu kini punya ruang kerja sendiri (kosong)
    update public.profil set role = 'pelatih' where role in ('guru','menunggu');
    insert into public._migrasi (nama) values ('ruang_kerja_v1');
  end if;
end $$;

-- Pemilik atlet tidak bisa dipindahkan ke akun lain.
create or replace function public.kunci_pemilik() returns trigger language plpgsql as $$
begin
  if new.pemilik is distinct from old.pemilik then raise exception 'Pemilik atlet tidak bisa diubah'; end if;
  return new;
end $$;
drop trigger if exists siswa_kunci_pemilik on public.siswa;
create trigger siswa_kunci_pemilik before update on public.siswa for each row execute function public.kunci_pemilik();

-- Inti aturan akses: boleh jika atlet milik saya, atau saya diundang pemiliknya
-- (untuk mengubah harus sebagai pelatih; bila cabor dibatasi, harus cabor yang cocok).
-- Akun yang dinonaktifkan pengelola (peran "menunggu") tidak bisa mengakses apa pun.
create or replace function public.akses_atlet(p_pemilik uuid, p_cabor text, p_ubah boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and coalesce(public.peran_saya(), 'menunggu') <> 'menunggu'
     and (p_pemilik = auth.uid()
          or exists (select 1 from public.akses a
                     where a.pemilik = p_pemilik and a.anggota = auth.uid() and a.diterima
                       and (not p_ubah or a.peran = 'pelatih')
                       and (cardinality(a.cabor) = 0 or p_cabor = any(a.cabor))))
$$;
create or replace function public.boleh_lihat_siswa(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.siswa s where s.id = sid and public.akses_atlet(s.pemilik, s.cabor, false))
$$;
create or replace function public.boleh_ubah_siswa(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.siswa s where s.id = sid and public.akses_atlet(s.pemilik, s.cabor, true))
$$;

-- Undang anggota tim lewat email (hanya pemilik yang bisa mengundang ke ruang kerjanya sendiri).
create or replace function public.undang_anggota(p_email text, p_peran text, p_cabor text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if auth.uid() is null or coalesce(public.peran_saya(), 'menunggu') = 'menunggu' then raise exception 'Tidak diizinkan'; end if;
  if p_peran not in ('pelatih','pengamat') then raise exception 'Peran tidak dikenal'; end if;
  select id into m from public.profil where lower(email) = lower(trim(p_email));
  if m is null then raise exception 'Email ini belum terdaftar. Minta orang tersebut mendaftar dulu di web, lalu undang lagi.'; end if;
  if m = auth.uid() then raise exception 'Tidak bisa mengundang akun sendiri'; end if;
  insert into public.akses (pemilik, anggota, peran, cabor) values (auth.uid(), m, p_peran, coalesce(p_cabor, '{}'))
    on conflict (pemilik, anggota) do update set peran = excluded.peran, cabor = excluded.cabor;
  return jsonb_build_object('ok', true);
end $$;

-- Akun yang diundang menerima atau menolak undangan.
create or replace function public.jawab_undangan(p_pemilik uuid, p_terima boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tidak diizinkan'; end if;
  if p_terima then update public.akses set diterima = true where pemilik = p_pemilik and anggota = auth.uid();
  else delete from public.akses where pemilik = p_pemilik and anggota = auth.uid(); end if;
end $$;
revoke all on function public.jawab_undangan(uuid, boolean) from public;
grant execute on function public.jawab_undangan(uuid, boolean) to authenticated;
revoke all on function public.undang_anggota(text, text, text[]) from public;
grant execute on function public.undang_anggota(text, text, text[]) to authenticated;

-- ---------- Input harian (wellness & beban) ----------
create table if not exists public.entri (
  id text primary key,                       -- <siswa_id>_<tanggal>
  siswa_id uuid not null references public.siswa(id) on delete cascade,
  tanggal date not null,
  tidur int, lelah int, otot int, stres int, mood int,
  nyeri int, area text[],
  rpe int, durasi int,
  tinggi numeric,
  dibuat timestamptz default now()
);
create index if not exists entri_tanggal_idx on public.entri (tanggal);
-- Kolom tambahan (aman dijalankan ulang pada database versi lama)
alter table public.entri add column if not exists jenis text;          -- jenis latihan
alter table public.entri add column if not exists hr_istirahat int;    -- denyut nadi istirahat pagi (bpm)
alter table public.entri add column if not exists hrv numeric;         -- HRV pagi (ms, RMSSD)
alter table public.entri add column if not exists sesi jsonb;          -- daftar sesi latihan hari itu [{id,jenis,rpe,durasi}]

-- ---------- Rencana latihan (kalender) ----------
create table if not exists public.rencana (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.siswa(id) on delete cascade,
  tanggal date not null,
  jenis text,
  judul text not null,
  deskripsi text,
  durasi int,                                -- menit
  rpe int,                                   -- target RPE 0–10
  dibuat timestamptz default now()
);
create index if not exists rencana_tanggal_idx on public.rencana (tanggal);

-- ---------- Tes kondisi fisik ----------
create table if not exists public.tes (
  id text primary key,                       -- <siswa_id>_<tanggal>
  siswa_id uuid not null references public.siswa(id) on delete cascade,
  tanggal date not null,
  sesi text,
  bb numeric,
  sprint30 numeric, ttest numeric, cone3 numeric, yoyo numeric,
  squat numeric, bench numeric, deadlift numeric, vj numeric,
  pushup numeric, situp numeric, wallsit numeric, sitreach numeric,
  diperbarui timestamptz default now()
);

-- ---------- Aturan akses (Row Level Security) ----------
alter table public.profil enable row level security;
alter table public.siswa  enable row level security;
alter table public.entri  enable row level security;
alter table public.tes    enable row level security;
alter table public.rencana enable row level security;
alter table public.akses   enable row level security;

drop policy if exists profil_baca on public.profil;
create policy profil_baca on public.profil for select
  using (id = auth.uid() or public.peran_saya() = 'admin'
         or exists (select 1 from public.akses a
                    where (a.pemilik = auth.uid() and a.anggota = profil.id)
                       or (a.anggota = auth.uid() and a.pemilik = profil.id)));

drop policy if exists akses_baca on public.akses;
create policy akses_baca on public.akses for select using (pemilik = auth.uid() or anggota = auth.uid());
drop policy if exists akses_ubah on public.akses;
create policy akses_ubah on public.akses for update using (pemilik = auth.uid()) with check (pemilik = auth.uid());
drop policy if exists akses_hapus on public.akses;
create policy akses_hapus on public.akses for delete using (pemilik = auth.uid() or anggota = auth.uid());
drop policy if exists profil_ubah on public.profil;
create policy profil_ubah on public.profil for update
  using (public.peran_saya() = 'admin') with check (public.peran_saya() = 'admin');

drop policy if exists siswa_baca on public.siswa;
create policy siswa_baca on public.siswa for select using (public.akses_atlet(pemilik, cabor, false));
drop policy if exists siswa_tambah on public.siswa;
create policy siswa_tambah on public.siswa for insert with check (public.akses_atlet(pemilik, cabor, true));
drop policy if exists siswa_ubah on public.siswa;
create policy siswa_ubah on public.siswa for update
  using (public.akses_atlet(pemilik, cabor, true)) with check (public.akses_atlet(pemilik, cabor, true));
drop policy if exists siswa_hapus on public.siswa;
create policy siswa_hapus on public.siswa for delete using (pemilik = auth.uid());

drop policy if exists entri_baca on public.entri;
create policy entri_baca on public.entri for select using (public.boleh_lihat_siswa(siswa_id));
drop policy if exists entri_tulis on public.entri;
create policy entri_tulis on public.entri for insert with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists entri_ubah on public.entri;
create policy entri_ubah on public.entri for update using (public.boleh_ubah_siswa(siswa_id)) with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists entri_hapus on public.entri;
create policy entri_hapus on public.entri for delete using (public.boleh_ubah_siswa(siswa_id));

drop policy if exists tes_baca on public.tes;
create policy tes_baca on public.tes for select using (public.boleh_lihat_siswa(siswa_id));
drop policy if exists tes_tulis on public.tes;
create policy tes_tulis on public.tes for insert with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists tes_ubah on public.tes;
create policy tes_ubah on public.tes for update using (public.boleh_ubah_siswa(siswa_id)) with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists tes_hapus on public.tes;
create policy tes_hapus on public.tes for delete using (public.boleh_ubah_siswa(siswa_id));

drop policy if exists rencana_baca on public.rencana;
create policy rencana_baca on public.rencana for select using (public.boleh_lihat_siswa(siswa_id));
drop policy if exists rencana_tulis on public.rencana;
create policy rencana_tulis on public.rencana for insert with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists rencana_ubah on public.rencana;
create policy rencana_ubah on public.rencana for update using (public.boleh_ubah_siswa(siswa_id)) with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists rencana_hapus on public.rencana;
create policy rencana_hapus on public.rencana for delete using (public.boleh_ubah_siswa(siswa_id));

-- ---------- Halaman atlet (tanpa login, memakai kode tautan) ----------
-- Atlet hanya bisa membaca & menulis data dirinya sendiri lewat dua fungsi ini.
create or replace function public.atlet_data(p_kode uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nama', s.nama, 'cabor', s.cabor, 'jk', s.jk, 'kelas', s.kelas, 'pelatih', s.pelatih,
    'tgl_lahir', s.tgl_lahir, 'bb', s.bb, 'tb', s.tb,
    'entri', coalesce((select jsonb_agg(to_jsonb(e) - 'siswa_id' order by e.tanggal)
                       from public.entri e where e.siswa_id = s.id and e.tanggal >= current_date - 150), '[]'::jsonb),
    'tes', coalesce((select jsonb_agg(to_jsonb(t) - 'siswa_id' order by t.tanggal)
                       from public.tes t where t.siswa_id = s.id), '[]'::jsonb),
    'rencana', coalesce((select jsonb_agg(jsonb_build_object('tanggal', r.tanggal, 'jenis', r.jenis, 'judul', r.judul,
                         'deskripsi', r.deskripsi, 'durasi', r.durasi, 'rpe', r.rpe) order by r.tanggal)
                       from public.rencana r where r.siswa_id = s.id and r.tanggal between current_date - 42 and current_date + 35), '[]'::jsonb))
  from public.siswa s where s.kode = p_kode
$$;

create or replace function public.atlet_simpan(p_kode uuid, p_tanggal date, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sid uuid; rid text; cur public.entri%rowtype; ss jsonb;
  w jsonb := p_data->'wellness'; ns jsonb := p_data->'sesi'; hapus text := p_data->>'hapus_sesi'; k text;
begin
  select id into sid from public.siswa where kode = p_kode;
  if sid is null then raise exception 'Tautan atlet tidak dikenal'; end if;
  if p_tanggal > current_date + 1 or p_tanggal < current_date - 7 then raise exception 'Tanggal di luar rentang'; end if;
  rid := sid::text || '_' || p_tanggal::text;
  insert into public.entri (id, siswa_id, tanggal) values (rid, sid, p_tanggal) on conflict (id) do nothing;
  select * into cur from public.entri where id = rid for update;
  ss := coalesce(cur.sesi, case when coalesce(cur.durasi, 0) > 0
          then jsonb_build_array(jsonb_build_object('id', 'lama', 'jenis', cur.jenis, 'rpe', cur.rpe, 'durasi', cur.durasi))
          else '[]'::jsonb end);
  if w is not null then
    foreach k in array array['tidur','lelah','otot','stres','mood'] loop
      if coalesce((w->>k)::int, 0) not between 1 and 5 then raise exception 'Nilai % harus 1–5', k; end if;
    end loop;
    if coalesce((w->>'nyeri')::int, 0) not between 0 and 10 then raise exception 'Nyeri harus 0–10'; end if;
    update public.entri set
      tidur = (w->>'tidur')::int, lelah = (w->>'lelah')::int, otot = (w->>'otot')::int,
      stres = (w->>'stres')::int, mood = (w->>'mood')::int, nyeri = coalesce((w->>'nyeri')::int, 0),
      area = array(select jsonb_array_elements_text(coalesce(w->'area', '[]'::jsonb))),
      hr_istirahat = case when (w->>'hr') ~ '^[0-9]+$' and (w->>'hr')::int between 30 and 120 then (w->>'hr')::int end,
      hrv = case when (w->>'hrv') ~ '^[0-9.]+$' and (w->>'hrv')::numeric between 5 and 250 then (w->>'hrv')::numeric end
    where id = rid;
  end if;
  if ns is not null then
    if coalesce((ns->>'rpe')::int, 0) not between 1 and 10 then raise exception 'RPE harus 1–10'; end if;
    if coalesce((ns->>'durasi')::int, 0) not between 1 and 400 then raise exception 'Durasi harus 1–400 menit'; end if;
    if not exists (select 1 from jsonb_array_elements(ss) x where x->>'id' = ns->>'id') then
      ss := ss || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id', coalesce(ns->>'id', gen_random_uuid()::text),
              'jenis', ns->>'jenis', 'rpe', (ns->>'rpe')::int, 'durasi', (ns->>'durasi')::int,
              -- data opsional dari file jam / Strava
              'hr', case when (ns->>'hr') ~ '^[0-9]+$' and (ns->>'hr')::int between 30 and 240 then (ns->>'hr')::int end,
              'hrmax', case when (ns->>'hrmax') ~ '^[0-9]+$' and (ns->>'hrmax')::int between 30 and 250 then (ns->>'hrmax')::int end,
              'km', case when (ns->>'km') ~ '^[0-9]+(\.[0-9]+)?$' and (ns->>'km')::numeric < 1000 then round((ns->>'km')::numeric, 2) end,
              'sumber', case when ns->>'sumber' in ('jam', 'manual') then ns->>'sumber' end)));
    end if;
  end if;
  if hapus is not null then
    ss := coalesce((select jsonb_agg(x) from jsonb_array_elements(ss) x where x->>'id' is distinct from hapus), '[]'::jsonb);
  end if;
  update public.entri set sesi = ss,
    durasi = (select coalesce(sum((x->>'durasi')::int), 0) from jsonb_array_elements(ss) x),
    rpe = (select case when coalesce(sum((x->>'durasi')::int), 0) > 0
                  then round(sum((x->>'rpe')::int * (x->>'durasi')::int)::numeric / sum((x->>'durasi')::int)) else 0 end
           from jsonb_array_elements(ss) x),
    jenis = ss->0->>'jenis'
  where id = rid;
  return (select to_jsonb(e) - 'siswa_id' from public.entri e where e.id = rid);
end $$;

revoke all on function public.atlet_data(uuid) from public;
revoke all on function public.atlet_simpan(uuid, date, jsonb) from public;
grant execute on function public.atlet_data(uuid) to anon, authenticated;
grant execute on function public.atlet_simpan(uuid, date, jsonb) to anon, authenticated;

-- ---------- Pembaruan langsung antar-perangkat ----------
do $$ begin
  begin alter publication supabase_realtime add table public.siswa;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.entri;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.tes;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.profil; exception when others then null; end;
  begin alter publication supabase_realtime add table public.rencana; exception when others then null; end;
  begin alter publication supabase_realtime add table public.akses; exception when others then null; end;
end $$;

-- =====================================================================
-- (Opsional) jadikan akun Anda pengelola platform agar bisa menonaktifkan akun lain.
-- Pengelola TIDAK bisa melihat atlet milik akun lain.
--   update public.profil set role = 'admin' where email = 'email-anda@contoh.com';
-- =====================================================================
