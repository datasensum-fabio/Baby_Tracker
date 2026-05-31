-- Per-baby alert thresholds (in minutes). NULL = alert disabled for that type.
create table if not exists public.baby_settings (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references public.babies(id) on delete cascade unique,
  feed_alert_min        integer default 180,   -- 3 hours
  sleep_alert_min       integer default null,  -- disabled
  medication_alert_min  integer default 720,   -- 12 hours
  nappy_alert_min       integer default null,  -- disabled
  updated_at  timestamptz default now()
);

-- RLS
alter table public.baby_settings enable row level security;

create policy "Carers can read settings"
  on public.baby_settings for select
  using (baby_id in (select public.my_baby_ids()));

create policy "Carers can insert settings"
  on public.baby_settings for insert
  with check (baby_id in (select public.my_baby_ids()));

create policy "Carers can update settings"
  on public.baby_settings for update
  using (baby_id in (select public.my_baby_ids()));
