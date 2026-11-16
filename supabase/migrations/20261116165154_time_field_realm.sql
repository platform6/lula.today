-- Time fields can belong to a realm (e.g. Game and Platform for Video games); none shows everywhere.
alter table public.time_fields add column if not exists area_id uuid references public.areas on delete cascade;
