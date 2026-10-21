-- Standalone lists of experiences, separate from task/project workflows.
-- Apply before deploying the app that syncs lists and list_items.
begin;

create table public.lists (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null check (kind in ('general', 'games', 'concerts', 'television')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.list_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  list_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  experienced_on date,
  rating smallint check (rating between 1 and 5),
  notes text,
  url text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (list_id, user_id) references public.lists (id, user_id) on delete cascade
);

create index lists_user_updated on public.lists (user_id, updated_at);
create index list_items_user_updated on public.list_items (user_id, updated_at);
create index list_items_list on public.list_items (list_id);

do $$
declare
  t text;
begin
  foreach t in array array['lists', 'list_items']
  loop
    execute format('create trigger set_updated_at before insert or update on public.%I
      for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner select" on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner insert" on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner update" on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner delete" on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

alter publication supabase_realtime add table public.lists, public.list_items;
commit;
