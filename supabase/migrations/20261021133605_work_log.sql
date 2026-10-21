-- Work log: where each day was worked, and bus tickets bought for office days.
-- A work day's id is derived client-side from the user and date (see
-- lib/worklog.ts), so two offline devices marking the same day converge on one
-- row; the unique index backs that up. Tickets left are computed client-side:
-- tickets bought minus 2 per office day.

create table if not exists public.work_days (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  day         date not null,
  status      text not null check (status in ('office', 'remote', 'off', 'holiday', 'jury')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index if not exists work_days_one_per_day on public.work_days (user_id, day);

create table if not exists public.bus_purchases (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  bought_on   date not null,
  tickets     smallint not null default 10 check (tickets > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists bus_purchases_user on public.bus_purchases (user_id);

-- Same as every synced table: server-set updated_at, owner-only RLS, live updates.
do $$
declare
  t text;
begin
  foreach t in array array['work_days', 'bus_purchases']
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

do $$
declare
  t text;
begin
  foreach t in array array['work_days', 'bus_purchases']
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
