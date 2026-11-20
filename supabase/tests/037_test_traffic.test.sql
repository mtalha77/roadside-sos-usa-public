-- Owner decision 2: test traffic is tagged and never reaches conversions or visit counts; the test
-- list is managed by staff and answered as yes or no to visitors. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(10);

create function pg_temp.as_staff(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000118a1',
    'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true),
    set_config('role', 'authenticated', true);
$$;
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000118a1', 'tt@example.test', 'authenticated', 'authenticated');
set constraints all immediate;

-- A request from test traffic (the website sends x-rsos-test: 1).
select set_config('request.headers', '{"x-rsos-test":"1"}', true);
insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone, service_id, market_service_id, pickup_point, pickup_address)
select '00000000-0000-4000-8000-0000000118c1', 'R-TSTA', ms.market_id, 0, 'submitted', 'web', 'Test', '+12105550145', ms.service_id, ms.id,
  extensions.st_setsrid(extensions.st_makepoint(-95.37, 29.76), 4326)::extensions.geography, 'Test address'
from public.market_services ms join public.markets m on m.id = ms.market_id join public.services s on s.id = ms.service_id
where m.slug = 'houston' and s.slug = 'flat-tire';
select ok((select is_test from public.requests where id = '00000000-0000-4000-8000-0000000118c1'), 'a test request is tagged');
select is((select count(*)::int from public.conversion_events where request_id = '00000000-0000-4000-8000-0000000118c1'), 0,
  'test traffic creates no conversion events (nothing reaches an ad platform)');
select set_config('test.visits_before', (select coalesce(sum(visits), 0)::text from public.site_visits where day = current_date and source = 'direct'), true);
select public.record_visit('houston', 'direct');
select is((select coalesce(sum(visits), 0)::text from public.site_visits where day = current_date and source = 'direct'),
  current_setting('test.visits_before'), 'test visits are not counted');
select public.record_funnel_event('test-session-0000000118', 'step', 'problem');
select ok((select is_test from public.funnel_events where session_id = 'test-session-0000000118'), 'test funnel events are tagged');

-- A normal request is not.
select set_config('request.headers', '{}', true);
insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone, service_id, market_service_id, pickup_point, pickup_address)
select '00000000-0000-4000-8000-0000000118c2', 'R-TSTB', ms.market_id, 0, 'submitted', 'web', 'Real', '+12105550146', ms.service_id, ms.id,
  extensions.st_setsrid(extensions.st_makepoint(-95.37, 29.76), 4326)::extensions.geography, 'Test address'
from public.market_services ms join public.markets m on m.id = ms.market_id join public.services s on s.id = ms.service_id
where m.slug = 'houston' and s.slug = 'flat-tire';
select ok(not (select is_test from public.requests where id = '00000000-0000-4000-8000-0000000118c2'), 'other requests are not tagged');

-- The test list.
select pg_temp.as_staff('dispatcher');
select throws_ok($$ select public.add_test_traffic_rule('ip', '203.0.113.0/24', 'Office') $$, '42501', null, 'dispatchers cannot change the list');
reset role;
select pg_temp.as_staff('marketing');
select lives_ok($$ select public.add_test_traffic_rule('ip', '203.0.113.0/24', 'Office') $$, 'marketing adds an IP range');
reset role;
set local role anon;
select ok((select public.is_test_traffic('203.0.113.7', '')), 'an IP in the range is test traffic');
select ok(not (select public.is_test_traffic('198.51.100.7', '')), 'another IP is not');
select throws_ok($$ select count(*) from public.test_traffic_rules $$, '42501', null, 'visitors cannot read the list');
reset role;

select * from finish();
rollback;
