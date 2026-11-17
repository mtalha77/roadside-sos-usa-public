-- Release QA (RSOS-036): the RSOS-031 trigger functions were executable through the API by
-- default. They only run as triggers, so nobody needs EXECUTE on them.
revoke all on function public.requests_conversions() from public, anon, authenticated;
revoke all on function public.calls_conversions() from public, anon, authenticated;
