-- Fix recursive RLS on carers table + add babies home view
-- Run this in Supabase SQL Editor

-- 1. Create a security-definer function to get the current user's baby IDs
--    (avoids infinite recursion in RLS policies)
create or replace function public.my_baby_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select baby_id from public.carers where user_id = auth.uid()
$$;

-- 2. Fix carers policies
drop policy if exists "User can read carers on their baby" on public.carers;

create policy "User can read carers on their baby"
  on public.carers for select
  using (
    user_id = auth.uid()
    or baby_id in (select public.my_baby_ids())
  );

-- 3. Fix activities policies (also use the function)
drop policy if exists "Carers can read activities"    on public.activities;
drop policy if exists "Carers can insert activities"  on public.activities;
drop policy if exists "Carers can update activities"  on public.activities;
drop policy if exists "Carers can delete activities"  on public.activities;

create policy "Carers can read activities"
  on public.activities for select
  using (baby_id in (select public.my_baby_ids()));

create policy "Carers can insert activities"
  on public.activities for insert
  with check (
    baby_id in (select public.my_baby_ids())
    and carer_id in (select id from public.carers where user_id = auth.uid())
  );

create policy "Carers can update activities"
  on public.activities for update
  using (baby_id in (select public.my_baby_ids()));

create policy "Carers can delete activities"
  on public.activities for delete
  using (baby_id in (select public.my_baby_ids()));

-- 4. Fix babies policies (also use the function)
drop policy if exists "Carers can read their baby"    on public.babies;
drop policy if exists "Authenticated users can read babies" on public.babies;

create policy "Authenticated users can read babies"
  on public.babies for select
  using (auth.uid() is not null);
