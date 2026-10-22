-- Files attached to tasks. The file itself lives in the private "attachments"
-- storage bucket under <user_id>/<attachment id>/<file name>; this table holds
-- its metadata and syncs like the other tables.
-- Apply before deploying the app that syncs attachments.
begin;

create table if not exists public.attachments (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  task_id     uuid not null references public.tasks on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  mime_type   text,
  size        bigint not null check (size >= 0),
  path        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists attachments_sync    on public.attachments (user_id, updated_at);
create index if not exists attachments_task_id on public.attachments (task_id);

create or replace trigger set_updated_at before insert or update on public.attachments
  for each row execute function public.set_updated_at();

alter table public.attachments enable row level security;
drop policy if exists "owner select" on public.attachments;
create policy "owner select" on public.attachments for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "owner insert" on public.attachments;
create policy "owner insert" on public.attachments for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "owner update" on public.attachments;
create policy "owner update" on public.attachments for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "owner delete" on public.attachments;
create policy "owner delete" on public.attachments for delete to authenticated
  using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.attachments to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    alter publication supabase_realtime add table public.attachments;
  end if;
end;
$$;

-- Private bucket, 10 MB per file. Each user reads and writes only their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "attachments owner select" on storage.objects;
create policy "attachments owner select" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "attachments owner insert" on storage.objects;
create policy "attachments owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "attachments owner delete" on storage.objects;
create policy "attachments owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
