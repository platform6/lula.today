-- lula.today — initial schema
-- Single-user, offline-first. Every row is owned by auth.uid() and carries
-- server-set updated_at (sync cursor) and deleted_at (soft delete for sync).

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Shared trigger: server-authoritative updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- position columns hold fractional-index strings; collate "C" gives the
-- byte-order comparison the fractional-indexing library expects.
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  color       text,
  icon        text,
  position    text collate "C" not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.projects (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  area_id     uuid references public.areas on delete set null,
  name        text not null,
  color       text,
  description text,
  due_date    date,
  is_inbox    boolean not null default false,
  position    text collate "C" not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- One Inbox per user
create unique index if not exists projects_one_inbox_per_user
  on public.projects (user_id) where is_inbox and deleted_at is null;

create table if not exists public.board_columns (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  project_id  uuid not null references public.projects on delete cascade,
  name        text not null,
  is_done     boolean not null default false,
  position    text collate "C" not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.tasks (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  project_id   uuid not null references public.projects on delete cascade,
  column_id    uuid not null references public.board_columns on delete restrict,
  title        text not null,
  notes        text,
  url          text,
  priority     smallint not null default 0 check (priority between 0 and 3), -- 0 none, 1 low, 2 med, 3 high
  due_at       timestamptz,
  due_has_time boolean not null default false,
  completed_at timestamptz,
  archived_at  timestamptz,
  position     text collate "C" not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.steps (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  task_id     uuid not null references public.tasks on delete cascade,
  text        text not null,
  is_done     boolean not null default false,
  position    text collate "C" not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.labels (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.task_labels (
  task_id     uuid not null references public.tasks on delete cascade,
  label_id    uuid not null references public.labels on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (task_id, label_id)
);

create table if not exists public.settings (
  user_id         uuid primary key default auth.uid() references auth.users on delete cascade,
  default_columns jsonb not null default
    '[{"name":"Backlog","is_done":false},{"name":"To Do","is_done":false},{"name":"Doing","is_done":false},{"name":"Done","is_done":true}]'::jsonb,
  theme           text not null default 'dark' check (theme in ('dark', 'light')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes: sync pulls (user_id, updated_at) and foreign keys
-- ---------------------------------------------------------------------------
create index if not exists areas_sync         on public.areas         (user_id, updated_at);
create index if not exists projects_sync      on public.projects      (user_id, updated_at);
create index if not exists board_columns_sync on public.board_columns (user_id, updated_at);
create index if not exists tasks_sync         on public.tasks         (user_id, updated_at);
create index if not exists steps_sync         on public.steps         (user_id, updated_at);
create index if not exists labels_sync        on public.labels        (user_id, updated_at);
create index if not exists task_labels_sync   on public.task_labels   (user_id, updated_at);

create index if not exists projects_area_id         on public.projects      (area_id);
create index if not exists board_columns_project_id on public.board_columns (project_id);
create index if not exists tasks_project_id         on public.tasks         (project_id);
create index if not exists tasks_column_id          on public.tasks         (column_id);
create index if not exists steps_task_id            on public.steps         (task_id);
create index if not exists task_labels_label_id     on public.task_labels   (label_id);
create index if not exists tasks_pending_archive    on public.tasks         (completed_at)
  where archived_at is null and completed_at is not null;

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS (owner-only access on every table)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['areas','projects','board_columns','tasks','steps','labels','task_labels','settings']
  loop
    execute format(
      'create or replace trigger set_updated_at before insert or update on public.%I
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "owner select" on public.%I', t);
    execute format(
      'create policy "owner select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "owner insert" on public.%I', t);
    execute format(
      'create policy "owner insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "owner update" on public.%I', t);
    execute format(
      'create policy "owner update" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "owner delete" on public.%I', t);
    execute format(
      'create policy "owner delete" on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-archive: completed tasks archive 7 days after completion.
-- Runs nightly at 08:00 UTC (~3–4am US Eastern). The updated_at trigger
-- bumps the row so the change syncs down to devices.
-- ---------------------------------------------------------------------------
create or replace function public.archive_completed_tasks()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tasks
     set archived_at = now()
   where archived_at is null
     and deleted_at is null
     and completed_at is not null
     and completed_at < now() - interval '7 days';
$$;

revoke execute on function public.archive_completed_tasks() from public, anon, authenticated;

-- Scheduling by name replaces any existing job, so re-running is safe.
select cron.schedule(
  'archive-completed-tasks',
  '0 8 * * *',
  $$select public.archive_completed_tasks()$$
);
