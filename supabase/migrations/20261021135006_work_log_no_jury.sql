-- The work log's "Jury duty / NH / Off" status was never used; drop it.

alter table public.work_days
  drop constraint if exists work_days_status_check,
  add constraint work_days_status_check check (status in ('office', 'remote', 'off', 'holiday'));
