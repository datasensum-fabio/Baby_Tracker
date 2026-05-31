-- Migration: add user_id to carers and replace RLS policies with auth-based ones.
-- Run this if you already have the original schema and existing data.

-- 1. Add user_id column
alter table public.carers
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_carers_user_id on public.carers(user_id);

-- 2. Drop the old open policies
drop policy if exists "Allow all" on public.babies;
drop policy if exists "Allow all" on public.carers;
drop policy if exists "Allow all" on public.activities;

-- 3. babies
create policy "Carers can read their baby"
  on public.babies for select
  using (id in (select baby_id from public.carers where user_id = auth.uid()));

create policy "Authenticated users can create a baby"
  on public.babies for insert
  with check (auth.uid() is not null);

create policy "Carers can update their baby"
  on public.babies for update
  using (id in (select baby_id from public.carers where user_id = auth.uid()));

-- 4. carers
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

-- 5. activities
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
