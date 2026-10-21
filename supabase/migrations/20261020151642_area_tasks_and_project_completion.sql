-- Inbox → Area → Project model.
-- Each area gets a built-in project (is_area_default) that holds tasks belonging
-- to the area but no project. Projects gain a completion timestamp.
-- Default projects are created client-side with deterministic ids derived from
-- the area id, so two offline devices creating one converge on the same row.

alter table public.projects
  add column is_area_default boolean not null default false,
  add column completed_at timestamptz;

alter table public.projects
  add constraint projects_area_default_has_area check (not is_area_default or area_id is not null);

create unique index projects_one_default_per_area
  on public.projects (area_id) where is_area_default and deleted_at is null;
