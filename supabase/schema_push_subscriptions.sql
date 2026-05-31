-- Store Web Push subscriptions per carer/device
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  carer_id     uuid not null references public.carers(id) on delete cascade,
  baby_id      uuid not null references public.babies(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz default now(),
  unique(carer_id, endpoint)
);

create index if not exists idx_push_subs_baby_id on public.push_subscriptions(baby_id);
create index if not exists idx_push_subs_carer_id on public.push_subscriptions(carer_id);

alter table public.push_subscriptions enable row level security;

create policy "Carers can manage own subscriptions"
  on public.push_subscriptions for all
  using (carer_id in (select id from public.carers where user_id = auth.uid()))
  with check (carer_id in (select id from public.carers where user_id = auth.uid()));

-- Track last notification sent per baby per alert key (to avoid spam)
alter table public.baby_settings
  add column if not exists last_alerts_sent jsonb default '{}';
