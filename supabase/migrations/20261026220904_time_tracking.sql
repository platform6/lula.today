-- Time tracking: entries, the tasks and tags they use, and extra fields.
-- A lula project (or a realm's own task list) is the time project: each project chooses
-- whether it shows a kanban board, time tracking, or both. A time task is a plain name
-- within a project, optionally linked to a card. Tags are separate from task labels.
-- Apply before deploying the app that syncs these tables.
begin;

alter table public.projects
  add column if not exists show_board boolean not null default true,
  add column if not exists track_time boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_shows_something') then
    alter table public.projects add constraint projects_shows_something check (show_board or track_time);
  end if;
end;
$$;

create table if not exists public.time_tags (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Extra fields defined in settings (e.g. Client); entries keep their values in time_entries.fields.
create table if not exists public.time_fields (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  kind        text not null default 'text' check (kind in ('text', 'choice')),
  choices     jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  position    text not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.time_tasks (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  project_id  uuid references public.projects on delete set null,
  name        text not null check (length(btrim(name)) > 0),
  task_id     uuid references public.tasks on delete set null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ended_at is null while the timer runs. No project means the entry is unsorted.
create table if not exists public.time_entries (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  started_at   timestamptz not null,
  ended_at     timestamptz check (ended_at >= started_at),
  project_id   uuid references public.projects on delete set null,
  time_task_id uuid references public.time_tasks on delete set null,
  tag_ids      uuid[] not null default '{}',
  description  text,
  fields       jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists time_tags_sync       on public.time_tags (user_id, updated_at);
create index if not exists time_fields_sync     on public.time_fields (user_id, updated_at);
create index if not exists time_tasks_sync      on public.time_tasks (user_id, updated_at);
create index if not exists time_tasks_project   on public.time_tasks (project_id);
create index if not exists time_tasks_task      on public.time_tasks (task_id);
create index if not exists time_entries_sync    on public.time_entries (user_id, updated_at);
create index if not exists time_entries_start   on public.time_entries (user_id, started_at);
create index if not exists time_entries_project on public.time_entries (project_id);
create index if not exists time_entries_task    on public.time_entries (time_task_id);

do $$
declare
  t text;
begin
  foreach t in array array['time_tags', 'time_fields', 'time_tasks', 'time_entries']
  loop
    execute format('create or replace trigger set_updated_at before insert or update on public.%I
      for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner select" on public.%I', t);
    execute format('create policy "owner select" on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "owner insert" on public.%I', t);
    execute format('create policy "owner insert" on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "owner update" on public.%I', t);
    execute format('create policy "owner update" on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "owner delete" on public.%I', t);
    execute format('create policy "owner delete" on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

commit;
