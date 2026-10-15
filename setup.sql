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

-- Setiap akun baru otomatis mendapat baris profil berstatus "menunggu".
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

create or replace function public.boleh_lihat_siswa(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.peran_saya()
    when 'admin' then true
    when 'guru' then true
    when 'pelatih' then exists (select 1 from public.siswa s where s.id = sid and s.cabor = any(public.cabor_saya()))
    else false end
$$;
create or replace function public.boleh_ubah_siswa(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.peran_saya()
    when 'admin' then true
    when 'pelatih' then exists (select 1 from public.siswa s where s.id = sid and s.cabor = any(public.cabor_saya()))
    else false end
$$;

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

drop policy if exists profil_baca on public.profil;
create policy profil_baca on public.profil for select
  using (id = auth.uid() or public.peran_saya() = 'admin');
drop policy if exists profil_ubah on public.profil;
create policy profil_ubah on public.profil for update
  using (public.peran_saya() = 'admin') with check (public.peran_saya() = 'admin');

drop policy if exists siswa_baca on public.siswa;
create policy siswa_baca on public.siswa for select
  using (public.peran_saya() in ('admin','guru')
         or (public.peran_saya() = 'pelatih' and cabor = any(public.cabor_saya())));
drop policy if exists siswa_tambah on public.siswa;
create policy siswa_tambah on public.siswa for insert
  with check (public.peran_saya() = 'admin'
              or (public.peran_saya() = 'pelatih' and cabor = any(public.cabor_saya())));
drop policy if exists siswa_ubah on public.siswa;
create policy siswa_ubah on public.siswa for update
  using (public.boleh_ubah_siswa(id))
  with check (public.peran_saya() = 'admin'
              or (public.peran_saya() = 'pelatih' and cabor = any(public.cabor_saya())));
drop policy if exists siswa_hapus on public.siswa;
create policy siswa_hapus on public.siswa for delete
  using (public.peran_saya() = 'admin');

drop policy if exists entri_baca on public.entri;
create policy entri_baca on public.entri for select using (public.boleh_lihat_siswa(siswa_id));
drop policy if exists entri_tulis on public.entri;
create policy entri_tulis on public.entri for insert with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists entri_ubah on public.entri;
create policy entri_ubah on public.entri for update using (public.boleh_ubah_siswa(siswa_id)) with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists entri_hapus on public.entri;
create policy entri_hapus on public.entri for delete using (public.peran_saya() = 'admin');

drop policy if exists tes_baca on public.tes;
create policy tes_baca on public.tes for select using (public.boleh_lihat_siswa(siswa_id));
drop policy if exists tes_tulis on public.tes;
create policy tes_tulis on public.tes for insert with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists tes_ubah on public.tes;
create policy tes_ubah on public.tes for update using (public.boleh_ubah_siswa(siswa_id)) with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists tes_hapus on public.tes;
create policy tes_hapus on public.tes for delete using (public.peran_saya() = 'admin');

drop policy if exists rencana_baca on public.rencana;
create policy rencana_baca on public.rencana for select using (public.boleh_lihat_siswa(siswa_id));
drop policy if exists rencana_tulis on public.rencana;
create policy rencana_tulis on public.rencana for insert with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists rencana_ubah on public.rencana;
create policy rencana_ubah on public.rencana for update using (public.boleh_ubah_siswa(siswa_id)) with check (public.boleh_ubah_siswa(siswa_id));
drop policy if exists rencana_hapus on public.rencana;
create policy rencana_hapus on public.rencana for delete using (public.boleh_ubah_siswa(siswa_id));

-- ---------- Pembaruan langsung antar-perangkat ----------
do $$ begin
  begin alter publication supabase_realtime add table public.siswa;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.entri;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.tes;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.profil; exception when others then null; end;
  begin alter publication supabase_realtime add table public.rencana; exception when others then null; end;
end $$;

-- =====================================================================
-- SETELAH Anda mendaftar lewat halaman web, jadikan akun Anda pengelola:
--   update public.profil set role = 'admin' where email = 'email-anda@contoh.com';
-- =====================================================================
