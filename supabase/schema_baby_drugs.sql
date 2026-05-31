-- Per-baby drug list with individual alert thresholds
create table if not exists public.baby_drugs (
  id           uuid primary key default gen_random_uuid(),
  baby_id      uuid not null references public.babies(id) on delete cascade,
  name         text not null,
  default_dose numeric,
  default_unit text not null default 'ml',
  alert_min    integer default null,  -- null = no alert
  is_default   boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz default now()
);

create index if not exists idx_baby_drugs_baby_id on public.baby_drugs(baby_id);

alter table public.baby_drugs enable row level security;

create policy "Carers can read drugs"
  on public.baby_drugs for select
  using (baby_id in (select public.my_baby_ids()));

create policy "Carers can insert drugs"
  on public.baby_drugs for insert
  with check (baby_id in (select public.my_baby_ids()));

create policy "Carers can update drugs"
  on public.baby_drugs for update
  using (baby_id in (select public.my_baby_ids()));

create policy "Carers can delete drugs"
  on public.baby_drugs for delete
  using (baby_id in (select public.my_baby_ids()));
