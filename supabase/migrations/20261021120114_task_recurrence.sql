-- Recurring tasks. A task with a repeat rule moves to its next due date when
-- completed instead of staying done. The rule's shape is the Recurrence type in
-- src/db/types.ts; the date math runs client-side (src/lib/recurrence.ts).

alter table public.tasks
  add column if not exists recurrence jsonb;

alter table public.tasks
  drop constraint if exists tasks_recurrence_is_object,
  add constraint tasks_recurrence_is_object check (recurrence is null or jsonb_typeof(recurrence) = 'object');
