-- Baby Tracker Schema
-- Run this in your Supabase SQL editor to set up the database.
-- If you already ran the previous version, run schema_migrate_auth.sql instead.

create table if not exists public.babies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  birth_date  date,
  code        text not null unique,
  created_at  timestamptz default now()
);

create table if not exists public.carers (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references public.babies(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  name        text not null,
  role        text not null default 'Carer',
  created_at  timestamptz default now()
);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references public.babies(id) on delete cascade,
  carer_id    uuid not null references public.carers(id) on delete cascade,
  type        text not null check (type in ('feed', 'sleep', 'medication', 'nappy')),
  details     jsonb not null default '{}',
  notes       text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz default now()
);

-- Indexes
create index if not exists idx_activities_baby_id   on public.activities(baby_id);
create index if not exists idx_activities_logged_at on public.activities(logged_at desc);
create index if not exists idx_activities_type      on public.activities(type);
create index if not exists idx_carers_baby_id       on public.carers(baby_id);
create index if not exists idx_carers_user_id       on public.carers(user_id);
create index if not exists idx_babies_code          on public.babies(code);

-- -------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------
alter table public.babies     enable row level security;
alter table public.carers     enable row level security;
alter table public.activities enable row level security;

-- Drop old permissive policies if re-running
drop policy if exists "Allow all" on public.babies;
drop policy if exists "Allow all" on public.carers;
drop policy if exists "Allow all" on public.activities;

-- babies: readable/writable by anyone who is a carer for that baby
create policy "Carers can read their baby"
  on public.babies for select
  using (id in (select baby_id from public.carers where user_id = auth.uid()));

create policy "Authenticated users can create a baby"
  on public.babies for insert
  with check (auth.uid() is not null);

-- babies: allow lookup by code for joining (unauthenticated check not needed — user is always logged in at join time)
create policy "Carers can update their baby"
  on public.babies for update
  using (id in (select baby_id from public.carers where user_id = auth.uid()));

-- carers: each user manages their own record; can read all carers on the same baby
create policy "User can read carers on their baby"
  on public.carers for select
  using (baby_id in (select baby_id from public.carers where user_id = auth.uid())
         or user_id = auth.uid());

create policy "Authenticated users can create carer"
  on public.carers for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "User can update own carer"
  on public.carers for update
  using (user_id = auth.uid());

create policy "User can delete own carer"
  on public.carers for delete
  using (user_id = auth.uid());

-- activities: readable/writable by all carers of the same baby
create policy "Carers can read activities"
  on public.activities for select
  using (baby_id in (select baby_id from public.carers where user_id = auth.uid()));

create policy "Carers can insert activities"
  on public.activities for insert
  with check (
    baby_id in (select baby_id from public.carers where user_id = auth.uid())
    and carer_id in (select id from public.carers where user_id = auth.uid())
  );

create policy "Carers can update activities"
  on public.activities for update
  using (baby_id in (select baby_id from public.carers where user_id = auth.uid()));

create policy "Carers can delete activities"
  on public.activities for delete
  using (baby_id in (select baby_id from public.carers where user_id = auth.uid()));

-- Enable realtime
alter publication supabase_realtime add table public.activities;
