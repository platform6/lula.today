-- Mark a time entry as done during a commute.
alter table public.time_entries add column if not exists commute boolean not null default false;
