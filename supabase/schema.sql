-- Baby Tracker Schema
-- Run this in your Supabase SQL editor to set up the database.

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

-- Indexes for performance
create index if not exists idx_activities_baby_id on public.activities(baby_id);
create index if not exists idx_activities_logged_at on public.activities(logged_at desc);
create index if not exists idx_activities_type on public.activities(type);
create index if not exists idx_carers_baby_id on public.carers(baby_id);
create index if not exists idx_babies_code on public.babies(code);

-- Row Level Security: allow all operations for now (code-based access control)
alter table public.babies enable row level security;
alter table public.carers enable row level security;
alter table public.activities enable row level security;

create policy "Allow all" on public.babies for all using (true) with check (true);
create policy "Allow all" on public.carers for all using (true) with check (true);
create policy "Allow all" on public.activities for all using (true) with check (true);

-- Enable realtime for activities table
alter publication supabase_realtime add table public.activities;
