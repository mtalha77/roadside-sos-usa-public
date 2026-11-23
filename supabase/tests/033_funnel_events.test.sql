-- RSOS-111: the website records Get Help funnel events through one function; only analytics staff
-- read them; repeats are deduplicated and bad input is ignored. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(10);

create function pg_temp.as_role(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000111a1',
    'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true),
    set_config('role', 'authenticated', true);
$$;
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000111a1', 'funnel@example.test', 'authenticated', 'authenticated');

set local role anon;
select lives_ok($$ select public.record_funnel_event('test-session-0000000001', 'step', 'problem', null, null, 'google_ads', 'mobile') $$,
  'a visitor records a step');
select lives_ok($$ select public.record_funnel_event('test-session-0000000001', 'step', 'problem') $$,
  'a repeat is accepted');
select lives_ok($$ select public.record_funnel_event('test-session-0000000001', 'left', 'location', 'address') $$,
  'a leave beacon is recorded');
select lives_ok($$ select public.record_funnel_event('test-session-0000000001', 'left', 'location', 'gps') $$,
  'a later beacon on the same step');
select lives_ok($$ select public.record_funnel_event('bad session!', 'step', 'nowhere') $$,
  'bad input is ignored, never an error');
select throws_ok($$ select count(*) from public.funnel_events $$, '42501', null, 'visitors cannot read events');
reset role;

select is((select count(*)::int from public.funnel_events where session_id = 'test-session-0000000001'), 2,
  'one row per session, event and step');
select is((select last_field from public.funnel_events where session_id = 'test-session-0000000001' and event = 'left'), 'gps',
  'the later leave beacon names the last field');

select pg_temp.as_role('marketing');
select is((select count(*)::int from public.funnel_events where session_id = 'test-session-0000000001'), 2,
  'marketing reads the events');
reset role;
select pg_temp.as_role('dispatcher');
select is((select count(*)::int from public.funnel_events where session_id = 'test-session-0000000001'), 0,
  'dispatchers do not read analytics events');
reset role;

select * from finish();
rollback;
