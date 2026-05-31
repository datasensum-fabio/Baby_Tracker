-- Allow unauthenticated users to read babies by code (needed for the invite/join page)
-- Baby data (name, DOB, code) is not sensitive — activities are the protected resource.

drop policy if exists "Authenticated users can read babies" on public.babies;

create policy "Anyone can read babies"
  on public.babies for select
  using (true);
