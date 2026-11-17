-- RSOS-034b: manual dispatch steps, claims, nearby providers, saved replies and the manual_test
-- fee row. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(18);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.provider_service_prices'::regclass, 'public.dispatch_attempts'::regclass, 'public.saved_replies'::regclass)),
  'RLS is on for every new table');

-- Data: a Houston dispatcher, a provider with a price for one service, and a phone intake request.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000004a1', 'dispatch-a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004a2', 'dispatch-b@example.test', 'authenticated', 'authenticated');
insert into public.staff_members (user_id, role, market_ids, display_name) values
  ('00000000-0000-4000-8000-0000000004a1', 'dispatcher', array[(select id from public.markets where slug = 'houston')], 'Dispatcher A'),
  ('00000000-0000-4000-8000-0000000004a2', 'dispatcher', array[(select id from public.markets where slug = 'houston')], 'Dispatcher B');
insert into public.providers (id, name, status, market_ids, is_demo, dispatch_phone, base_point, service_radius_miles)
values ('00000000-0000-4000-8000-0000000004b1', 'Test Tow Partner', 'active', array[(select id from public.markets where slug = 'houston')], false,
        '+12105550140', extensions.st_point(-95.37, 29.76)::extensions.geography, 25);
insert into public.provider_service_prices (provider_id, market_id, service_id, price_cents) values
  ('00000000-0000-4000-8000-0000000004b1', (select id from public.markets where slug = 'houston'), (select id from public.services where slug = 'tow'), 12500);
insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone)
values ('00000000-0000-4000-8000-0000000004c1', 'R-DSP2', (select id from public.markets where slug = 'houston'), 0, 'phone_intake', 'phone', 'Caller', '+12105550141');

create function pg_temp.as_a() returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000004a1', 'role', 'authenticated', 'aal', 'aal2',
    'app_role', 'staff', 'staff_role', 'dispatcher', 'staff_markets', jsonb_build_array((select id from public.markets where slug = 'houston'))));
$$;
create function pg_temp.as_b() returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000004a2', 'role', 'authenticated', 'aal', 'aal2',
    'app_role', 'staff', 'staff_role', 'dispatcher', 'staff_markets', jsonb_build_array((select id from public.markets where slug = 'houston'))));
$$;

-- Claims: A claims; B cannot take it while A's claim is fresh; B can after 10 minutes.
select pg_temp.as_a();
select ok(public.claim_request('00000000-0000-4000-8000-0000000004c1'), 'a dispatcher claims a request');
reset role;
select pg_temp.as_b();
select ok(not public.claim_request('00000000-0000-4000-8000-0000000004c1'), 'another dispatcher cannot take a fresh claim');
reset role;
update public.requests set claimed_at = now() - interval '11 minutes' where id = '00000000-0000-4000-8000-0000000004c1';
select pg_temp.as_b();
select ok(public.claim_request('00000000-0000-4000-8000-0000000004c1'), 'a claim lapses after 10 minutes without action');
reset role;

-- Steps move forward, need the location before assignment, and reasons to end.
select pg_temp.as_a();
select lives_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'contacted') $$, 'new -> contacted');
select throws_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'phone_intake') $$, '22023', null, 'steps never go back');
select throws_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'location_confirmed') $$, '22023', null,
  'the location and service come first');
reset role;
update public.requests set
  service_id = (select id from public.services where slug = 'tow'),
  market_service_id = (select id from public.current_market_services where market_id = (select id from public.markets where slug = 'houston')
                       and service_id = (select id from public.services where slug = 'tow')),
  pickup_point = extensions.st_point(-95.40, 29.75)::extensions.geography, pickup_address = 'Test address'
where id = '00000000-0000-4000-8000-0000000004c1';
select pg_temp.as_a();
select lives_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'location_confirmed') $$, 'contacted -> location confirmed');
select is((select provider_id from public.nearby_providers('00000000-0000-4000-8000-0000000004c1') limit 1),
  '00000000-0000-4000-8000-0000000004b1'::uuid, 'the provider priced for the service is listed');
select ok((select in_radius from public.nearby_providers('00000000-0000-4000-8000-0000000004c1') limit 1), 'and is inside its radius');
select throws_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'assigned') $$, '22023', null,
  'assigning needs provider, price and ETA');
select lives_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'assigned', null, '00000000-0000-4000-8000-0000000004b1', 12500, 25) $$,
  'location confirmed -> assigned');
select is((select count(*)::int from public.provider_billing_events where request_id = '00000000-0000-4000-8000-0000000004c1' and kind = 'manual_test'),
  1, 'assignment writes one manual_test fee row');
select is((select count(*)::int from public.dispatch_attempts where request_id = '00000000-0000-4000-8000-0000000004c1' and outcome = 'assigned'),
  1, 'and an assigned attempt');
select throws_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'cancelled') $$, '22023', null, 'cancelling needs a reason');
select lives_ok($$ select public.dispatch_step('00000000-0000-4000-8000-0000000004c1', 'en_route') $$, 'assigned -> on the way');
select throws_ok($$ insert into public.saved_replies (title, body) values ('Nope', 'Dispatchers cannot add these') $$, '42501', null,
  'dispatchers cannot edit saved replies');
reset role;

set local role anon;
select throws_ok($$ select * from public.nearby_providers('00000000-0000-4000-8000-0000000004c1') $$, '42501', null,
  'visitors cannot list providers');
reset role;

select * from finish();
rollback;
