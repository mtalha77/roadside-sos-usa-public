-- RSOS-021b: Postgres rate limits and API usage counters. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(16);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.rate_limit_counters'::regclass), 'RLS on rate_limit_counters');
select ok((select relrowsecurity from pg_class where oid = 'public.api_usage'::regclass), 'RLS on api_usage');
select ok((select relrowsecurity from pg_class where oid = 'public.usage_thresholds'::regclass), 'RLS on usage_thresholds');

-- Visitors can count hits through the function, never read the table.
set local role anon;
select is(public.rate_limit_hit('code:phone:+12105550100', 600), 1, 'first hit counts 1');
select is(public.rate_limit_hit('code:phone:+12105550100', 600), 2, 'second hit counts 2');
select throws_ok($$ select * from public.rate_limit_counters $$, '42501', null, 'visitors cannot read counters');
select throws_ok($$ select public.rate_limit_hit('x', 600) $$, '22023', null, 'bad keys are rejected');
select throws_ok($$ select * from public.api_usage $$, '42501', null, 'visitors cannot read usage');
reset role;

-- Usage: counting crosses the threshold once and alerts once.
update public.usage_thresholds set daily_units = 3 where vendor_group = 'maps';
select is((select alert from public.record_api_usage('maps_autocomplete', 2)), false, 'under the threshold: no alert');
select is((select alert from public.record_api_usage('maps_geocode', 1)), true, 'crossing the group threshold alerts');
select is((select alert from public.record_api_usage('maps_geocode', 1)), false, 'only one alert per day');
select throws_ok($$ select * from public.record_api_usage('stripe_x', 1) $$, '22023', null, 'unknown vendors are rejected');

-- Staff read usage; a dispatcher cannot change thresholds.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'dispatcher'));
select ok((select count(*) from public.api_usage) >= 2, 'staff read today''s usage');
update public.usage_thresholds set daily_units = 1 where vendor_group = 'twilio';
reset role;
select is((select daily_units from public.usage_thresholds where vendor_group = 'twilio'), 300, 'a dispatcher cannot change thresholds');

-- SMS sign-in lookup is for the server (service role) only.
set local role anon;
select throws_ok($$ select * from public.auth_user_for_phone('+12105550191') $$, '42501', null, 'visitors cannot look up accounts by phone');
reset role;
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated'));
select throws_ok($$ select * from public.auth_user_for_phone('+12105550191') $$, '42501', null, 'signed-in users cannot either');
reset role;

select * from finish();
rollback;
