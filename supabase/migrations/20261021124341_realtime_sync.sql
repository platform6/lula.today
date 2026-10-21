-- Live updates: publish changes on the synced tables over Supabase Realtime.
-- The app treats any change event as a cue to run its normal pull (it never
-- applies the event payload itself), so the updated_at cursor stays the single
-- source of truth. Realtime enforces the tables' RLS for each subscriber.

do $$
declare
  t text;
begin
  foreach t in array array['settings', 'areas', 'projects', 'board_columns', 'tasks', 'steps', 'labels', 'task_labels']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
