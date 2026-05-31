-- Add active flag to carers so users can soft-remove babies from their home screen
alter table public.carers
  add column if not exists active boolean not null default true;

create index if not exists idx_carers_active on public.carers(active);
