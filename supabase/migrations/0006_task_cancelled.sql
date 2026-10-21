-- Cancelled tasks: dropped without being done. Cancelling also archives the
-- task (archived_at), so it leaves every list and shows in the Archive marked
-- "Cancelled"; restoring clears both.

alter table public.tasks
  add column cancelled_at timestamptz;
