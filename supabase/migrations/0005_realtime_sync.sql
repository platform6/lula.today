-- Live updates: publish changes on the synced tables over Supabase Realtime.
-- The app treats any change event as a cue to run its normal pull (it never
-- applies the event payload itself), so the updated_at cursor stays the single
-- source of truth. Realtime enforces the tables' RLS for each subscriber.

alter publication supabase_realtime add table
  public.settings,
  public.areas,
  public.projects,
  public.board_columns,
  public.tasks,
  public.steps,
  public.labels,
  public.task_labels;
