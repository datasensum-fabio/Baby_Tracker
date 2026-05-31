-- Soft delete for activities: add deleted_at column
-- Deleted activities are hidden from normal queries but accessible for restore.

alter table public.activities
  add column if not exists deleted_at timestamptz default null;

create index if not exists idx_activities_deleted_at on public.activities(deleted_at)
  where deleted_at is not null;
