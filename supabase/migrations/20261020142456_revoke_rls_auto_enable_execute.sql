-- rls_auto_enable() is Supabase's event-trigger function that enables RLS on new
-- public tables. It only needs to run as an event trigger, not via the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
