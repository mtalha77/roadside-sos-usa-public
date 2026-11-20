-- Owner decision 3: customers and providers flag requests; safety is urgent; staff in the market
-- read and resolve flags; providers only see and raise their own. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(16);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;
create function pg_temp.staff(r text, market text) returns jsonb language sql as $$
  select jsonb_build_object('sub', '00000000-0000-4000-8000-0000000119a1', 'role', 'authenticated', 'aal', 'aal2',
    'app_role', 'staff', 'staff_role', r, 'staff_markets', jsonb_build_array((select id from public.markets where slug = market)));
$$;
create function pg_temp.provider(p uuid) returns jsonb language sql as $$
  select jsonb_build_object('sub', '00000000-0000-4000-8000-0000000119a2', 'role', 'authenticated', 'aal', 'aal1',
    'app_role', 'provider', 'providers', jsonb_build_array(jsonb_build_object('provider_id', p, 'role', 'operator')));
$$;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000119a1', 'flags-staff@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000119a2', 'flags-pro@example.test', 'authenticated', 'authenticated');
insert into public.providers (id, name, status) values
  ('00000000-0000-4000-8000-0000000119b1', 'Flag Test Towing', 'active'),
  ('00000000-0000-4000-8000-0000000119b2', 'Other Test Towing', 'active');
insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone, assigned_provider_id, status_token, service_id, market_service_id, pickup_point, pickup_address)
select '00000000-0000-4000-8000-0000000119c1', 'R-FLGA', ms.market_id, 0, 'completed', 'web',
        'Flag Test', '+17135550147', '00000000-0000-4000-8000-0000000119b1', 'flag-test-token-000000000000000001', ms.service_id, ms.id,
  extensions.st_setsrid(extensions.st_makepoint(-95.37, 29.76), 4326)::extensions.geography, 'Test address'
from public.market_services ms join public.markets m on m.id = ms.market_id join public.services s on s.id = ms.service_id
where m.slug = 'houston' and s.slug = 'flat-tire';
set constraints all immediate;

-- Customer side, from the tracking link (anonymous).
set local role anon;
select lives_ok($$ select public.flag_request_as_customer('flag-test-token-000000000000000001', 'price_changed', 'Asked for more') $$,
  'a customer reports a problem after completion');
select lives_ok($$ select public.flag_request_as_customer('flag-test-token-000000000000000001', 'safety', null) $$,
  'and a safety concern');
select throws_ok($$ select public.flag_request_as_customer('flag-test-token-000000000000000001', 'fake', null) $$,
  '22023', null, 'customers cannot use provider reasons');
select throws_ok($$ select public.flag_request_as_customer('not-a-real-token-0000000000000000', 'other', null) $$,
  'P0002', null, 'an unknown link flags nothing');
select throws_ok($$ select count(*) from public.request_flags $$, '42501', null, 'visitors cannot read flags');
reset role;

select is((select priority from public.request_flags where request_id = '00000000-0000-4000-8000-0000000119c1' and reason = 'safety'),
  'urgent', 'a safety report is urgent');
select is((select priority from public.request_flags where request_id = '00000000-0000-4000-8000-0000000119c1' and reason = 'price_changed'),
  'normal', 'other reports are normal');
select ok((select urgent from public.requests where id = '00000000-0000-4000-8000-0000000119c1'), 'and the request becomes urgent');
select is((select provider_id from public.request_flags where reason = 'price_changed' and request_id = '00000000-0000-4000-8000-0000000119c1'),
  '00000000-0000-4000-8000-0000000119b1'::uuid, 'the customer flag names the assigned provider');

-- Provider side.
select pg_temp.as_user(pg_temp.provider('00000000-0000-4000-8000-0000000119b1'));
select lives_ok($$ select public.flag_request_as_provider('00000000-0000-4000-8000-0000000119b1', '00000000-0000-4000-8000-0000000119c1', 'unreachable', null) $$,
  'the assigned provider flags the request');
select is((select count(*)::int from public.request_flags), 1, 'providers see only their own flags');
select throws_ok($$ select public.flag_request_as_provider('00000000-0000-4000-8000-0000000119b2', '00000000-0000-4000-8000-0000000119c1', 'fake', null) $$,
  '42501', null, 'not for another company');
reset role;
select pg_temp.as_user(pg_temp.provider('00000000-0000-4000-8000-0000000119b2'));
select throws_ok($$ select public.flag_request_as_provider('00000000-0000-4000-8000-0000000119b2', '00000000-0000-4000-8000-0000000119c1', 'fake', null) $$,
  'P0002', null, 'a company never offered the request cannot flag it');
reset role;

-- Staff.
select pg_temp.as_user(pg_temp.staff('dispatcher', 'san-antonio'));
select is((select count(*)::int from public.request_flags where request_id = '00000000-0000-4000-8000-0000000119c1'), 0,
  'staff in another market do not see the flags');
reset role;
select pg_temp.as_user(pg_temp.staff('dispatcher', 'houston'));
select is((select count(*)::int from public.request_flags where request_id = '00000000-0000-4000-8000-0000000119c1'), 3,
  'staff in the market see every flag');
select public.resolve_request_flag((select id from public.request_flags where reason = 'safety' and request_id = '00000000-0000-4000-8000-0000000119c1'), 'Called the customer');
select is((select status from public.request_flags where reason = 'safety' and request_id = '00000000-0000-4000-8000-0000000119c1'),
  'resolved', 'a dispatcher resolves a flag');
reset role;

select * from finish();
rollback;
