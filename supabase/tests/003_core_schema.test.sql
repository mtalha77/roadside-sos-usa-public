-- RSOS-016: core schema v1. Runs inside a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(30);

-- Fixtures: a square test market around (29.4, -98.5), a second one far away, one service.
insert into public.markets (id, slug, name, state_code, time_zone, center, boundary, status, support_phone)
values
  ('00000000-0000-4000-8000-000000000001', 'rls-test-metro', 'RLS Test Metro', 'TX', 'America/Chicago',
   'SRID=4326;POINT(-98.5 29.4)', 'SRID=4326;MULTIPOLYGON(((-98.7 29.2,-98.3 29.2,-98.3 29.6,-98.7 29.6,-98.7 29.2)))', 'test', '+12105550100'),
  ('00000000-0000-4000-8000-000000000002', 'rls-other-metro', 'RLS Other Metro', 'NV', 'America/Los_Angeles',
   'SRID=4326;POINT(-115.1 36.1)', 'SRID=4326;MULTIPOLYGON(((-115.3 35.9,-114.9 35.9,-114.9 36.3,-115.3 36.3,-115.3 35.9)))', 'active', null);
insert into public.services (id, slug, name, icon_key, sort_order)
values ('00000000-0000-4000-8000-0000000000a1', 'rls-test-flat-tire', 'Flat tire', 'flat-tire', 1);
insert into public.market_services (market_id, service_id, enabled, price_min_cents, price_max_cents, platform_fee_cents, effective_from)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', true, 5000, 16000, 2250, now() - interval '1 day');

-- 1. Every public table has RLS enabled.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is enabled on every table in public'
);

-- 2. Market for a point (AC1).
select is((select slug from public.market_for_point(29.4, -98.5)), 'rls-test-metro', 'point inside the test market returns it');
select is((select slug from public.market_for_point(36.1, -115.1)), 'rls-other-metro', 'point inside the other market returns it');
select is_empty($$ select * from public.market_for_point(40.7, -74.0) $$, 'point outside every market returns none');

-- 3. Fee history (AC3): a request snapshots the fee in effect.
create temporary table t_req as
select * from public.create_request(jsonb_build_object(
  'service_slug', 'rls-test-flat-tire', 'driver_name', 'Test Driver', 'driver_phone', '+12105550123',
  'pickup', jsonb_build_object('lat', 29.41, 'lng', -98.49, 'address', '1 Test Street'),
  'attribution', jsonb_build_object('utm_source', 'google', 'gclid', 'test-gclid'),
  'consents', jsonb_build_array(jsonb_build_object('type', 'sms_transactional', 'granted', true, 'policy_version', '2026-11-13')),
  'consent_ip', '203.0.113.7', 'user_agent', 'pgTAP'
));
select matches((select short_code from t_req), '^R-[23456789A-HJ-NP-Z]{4}$', 'request gets a short code like R-7KQ2');
select ok(length((select status_token from t_req)) >= 32, 'request gets a long secret status token');
select is((select platform_fee_cents from public.requests where id = (select request_id from t_req)), 2250, 'request stores the fee in effect');
select is((select count(*)::int from public.attributions where request_id = (select request_id from t_req)), 1, 'attribution saved in the same transaction');
select is((select count(*)::int from public.consents where request_id = (select request_id from t_req)), 1, 'consent saved with its policy version');
select is((select policy_version from public.consents where request_id = (select request_id from t_req)), '2026-11-13', 'consent links to the policy version');
select is((select event_type from public.request_events where request_id = (select request_id from t_req)), 'created', 'first event recorded');

insert into public.market_services (market_id, service_id, enabled, price_min_cents, price_max_cents, platform_fee_cents, effective_from)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', true, 5500, 17000, 2500, now() - interval '1 minute');
select is((select platform_fee_cents from public.current_market_services where market_id = '00000000-0000-4000-8000-000000000001'), 2500, 'a new dated row becomes the current fee');
select is((select count(*)::int from public.market_services where market_id = '00000000-0000-4000-8000-000000000001'), 2, 'the old fee row is kept');
select is((select platform_fee_cents from public.requests where id = (select request_id from t_req)), 2250, 'the old request keeps its fee');
select throws_ok($$ update public.market_services set platform_fee_cents = 1 $$, '0A000', null, 'fee rows cannot be overwritten');
select throws_ok($$ delete from public.market_services $$, '0A000', null, 'fee rows cannot be deleted');

-- 4. Validation in create_request.
select throws_ok($$ select * from public.create_request('{"service_slug":"rls-test-flat-tire","driver_name":"X","driver_phone":"555","pickup":{"lat":29.4,"lng":-98.5,"address":"a"}}') $$,
  '22023', null, 'invalid phone is rejected');
select throws_ok($$ select * from public.create_request('{"service_slug":"rls-test-flat-tire","driver_name":"X","driver_phone":"+12105550123","pickup":{"lat":40.7,"lng":-74.0,"address":"a"}}') $$,
  '22023', null, 'location outside every market is rejected');

-- 5. Status page by token: safe fields only.
select is((select status::text from public.get_request_by_token((select status_token from t_req))), 'submitted', 'token returns the request status');
select is_empty($$ select * from public.get_request_by_token('not-a-real-token-but-long-enough') $$, 'wrong token returns nothing');
select unalike(pg_get_function_result('public.get_request_by_token(text)'::regprocedure), '%phone%', 'token result exposes no phone');

-- 6. Anonymous users cannot read or write any table directly (AC2).
grant usage on schema public to anon; -- (already granted by Supabase; explicit for clarity)
set local role anon;
select throws_ok($$ select 1 from public.markets $$, '42501', null, 'anon cannot read markets');
select throws_ok($$ select 1 from public.requests $$, '42501', null, 'anon cannot read requests');
select throws_ok($$ select 1 from public.consents $$, '42501', null, 'anon cannot read consents');
select throws_ok($$ select 1 from public.audit_log $$, '42501', null, 'anon cannot read the audit log');
select throws_ok($$ insert into public.waitlist (email) values ('x@example.test') $$, '42501', null, 'anon cannot insert into tables');
select throws_ok($$ select 1 from public.current_market_services $$, '42501', null, 'anon cannot read the fee view');
select is((select slug from public.market_for_point(29.4, -98.5)), 'rls-test-metro', 'anon can use the public market lookup function');
reset role;

-- 7. Signed-in users without a staff role see nothing yet (policies arrive in RSOS-018).
set local role authenticated;
select is_empty($$ select 1 from public.requests $$, 'authenticated users see no requests without a policy');
select is_empty($$ select 1 from public.markets $$, 'authenticated users see no markets without a policy');
reset role;

select * from finish();
rollback;
