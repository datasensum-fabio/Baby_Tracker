-- Fix RLS: allow authenticated users to read babies (needed for create & join flows)
-- Baby data (name, DOB) is not sensitive — activities are the protected resource.

-- Drop the restrictive select policy
drop policy if exists "Carers can read their baby" on public.babies;

-- Replace with: any logged-in user can read babies (required to look up by code when joining)
create policy "Authenticated users can read babies"
  on public.babies for select
  using (auth.uid() is not null);

-- Also allow carers to read all carers on the same baby (needed for join duplicate check)
drop policy if exists "User can read carers on their baby" on public.carers;

create policy "User can read carers on their baby"
  on public.carers for select
  using (
    user_id = auth.uid()
    or baby_id in (select baby_id from public.carers where user_id = auth.uid())
  );
