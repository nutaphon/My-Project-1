-- ════════════════════════════════════════════════════════════════
--  Meal Split · หารค่าข้าว — Supabase schema
--  Run once in Supabase → SQL Editor → New query → paste → Run
-- ════════════════════════════════════════════════════════════════

-- 1) Who is allowed to use the app (only you two) --------------------
create table if not exists public.members (
  email text primary key
);
alter table public.members enable row level security;  -- no policies = not readable from the browser

-- 👇 CHANGE THESE to your two login emails, then run this file
insert into public.members (email) values
  ('you@example.com'),
  ('partner@example.com')
on conflict do nothing;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m where lower(m.email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 2) Tables -----------------------------------------------------------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  title       text not null default '',
  category    text not null default 'lunch',
  payer       text not null check (payer in ('a', 'b')),
  split       text not null default 'equal' check (split in ('equal', 'items')),
  total       numeric(12, 2) not null check (total >= 0),
  items       jsonb not null default '[]'::jsonb,   -- [{name, price, owner: 'a'|'b'|'both'}]
  slip_path   text,
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (date desc);

create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  from_person text not null check (from_person in ('a', 'b')),
  amount      numeric(12, 2) not null check (amount > 0),
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.settings (
  id     int primary key default 1 check (id = 1),
  name_a text,
  name_b text
);
insert into public.settings (id, name_a, name_b) values (1, null, null) on conflict do nothing;

-- 3) Row Level Security: only members can read/write -------------------
alter table public.expenses    enable row level security;
alter table public.settlements enable row level security;
alter table public.settings    enable row level security;

drop policy if exists "members all" on public.expenses;
create policy "members all" on public.expenses
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members all" on public.settlements;
create policy "members all" on public.settlements
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members all" on public.settings;
create policy "members all" on public.settings
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- 4) Private storage bucket for slips -------------------------------
insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;

drop policy if exists "slips members read"   on storage.objects;
drop policy if exists "slips members insert" on storage.objects;
drop policy if exists "slips members delete" on storage.objects;
create policy "slips members read"   on storage.objects for select to authenticated using (bucket_id = 'slips' and public.is_member());
create policy "slips members insert" on storage.objects for insert to authenticated with check (bucket_id = 'slips' and public.is_member());
create policy "slips members delete" on storage.objects for delete to authenticated using (bucket_id = 'slips' and public.is_member());

-- 5) Realtime: partner's phone updates instantly ----------------------
do $$
begin
  alter publication supabase_realtime add table public.expenses, public.settlements, public.settings;
exception when duplicate_object then null;
end $$;
