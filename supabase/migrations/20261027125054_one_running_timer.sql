-- One running timer per person, across devices.
--
-- Each device only stops its own running timer when it starts another, so two
-- devices (or one that was offline) can each push a running entry. When a
-- running entry arrives, the most recently started one keeps running and the
-- other is stopped where the newer one began, as starting a timer does locally.

create or replace function public.time_entries_one_running()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  newest timestamptz;
begin
  if new.ended_at is not null or new.deleted_at is not null then
    return new;
  end if;

  -- Serialise a person's timer changes so two pushes can't both keep running.
  perform pg_advisory_xact_lock(hashtext('time_entries_one_running:' || new.user_id::text));

  select max(started_at) into newest
  from public.time_entries
  where user_id = new.user_id and id <> new.id and ended_at is null and deleted_at is null;

  if newest is null then
    return new;
  end if;

  if newest > new.started_at then
    -- Another timer started later: this one stops where that one began.
    new.ended_at := newest;
  else
    update public.time_entries
    set ended_at = greatest(started_at, new.started_at)
    where user_id = new.user_id and id <> new.id and ended_at is null and deleted_at is null;
  end if;
  return new;
end;
$$;

create or replace trigger one_running before insert or update on public.time_entries
  for each row execute function public.time_entries_one_running();

-- Backstop: the trigger keeps this from ever failing a push.
create unique index if not exists time_entries_one_running
  on public.time_entries (user_id) where ended_at is null and deleted_at is null;
