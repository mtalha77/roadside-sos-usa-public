-- RSOS-030: calls, intake requests, shifts, presence, location links, texts, opt-outs and webhook
-- idempotency. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(21);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

-- RLS on every new table.
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.calls'::regclass, 'public.dispatcher_shifts'::regclass, 'public.dispatcher_status'::regclass,
  'public.location_links'::regclass, 'public.sms_messages'::regclass, 'public.sms_opt_outs'::regclass,
  'public.webhook_events'::regclass)), 'RLS is on for every new table');

-- Test data (service role / owner).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000003a1', 'calls-dispatcher@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000003a2', 'calls-other@example.test', 'authenticated', 'authenticated');
insert into public.staff_members (user_id, role, market_ids, display_name, mobile_phone) values
  ('00000000-0000-4000-8000-0000000003a1', 'dispatcher', array[(select id from public.markets where slug = 'houston')], 'Test Dispatcher', '+12105550101'),
  ('00000000-0000-4000-8000-0000000003a2', 'dispatcher', array[(select id from public.markets where slug = 'las-vegas')], 'Other Dispatcher', null);

-- Phone intake requests may start without service or location; web requests may not.
select lives_ok($$
  insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone, source)
  values ('00000000-0000-4000-8000-0000000003b1', 'R-TST2', (select id from public.markets where slug = 'houston'), 0, 'phone_intake', 'phone', 'Caller', '+12105550102', 'website')
$$, 'a phone intake request needs no service or location yet');
select throws_ok($$
  insert into public.requests (short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone)
  values ('R-TST3', (select id from public.markets where slug = 'houston'), 0, 'submitted', 'web', 'Driver', '+12105550103')
$$, '23514', null, 'a submitted request still needs service and location');

insert into public.calls (twilio_call_sid, market_id, direction, source, from_phone, to_phone, request_id)
values ('CA' || repeat('a', 32), (select id from public.markets where slug = 'houston'), 'inbound', 'website', '+12105550102', '+12105550199', '00000000-0000-4000-8000-0000000003b1');
select throws_ok($$
  insert into public.calls (twilio_call_sid, market_id, direction, from_phone, to_phone)
  values ('CA' || repeat('a', 32), (select id from public.markets where slug = 'houston'), 'inbound', '+12105550102', '+12105550199')
$$, '23505', null, 'a call SID is stored once (idempotent webhooks)');
select throws_ok($$ insert into public.calls (twilio_call_sid, market_id, direction, from_phone, to_phone)
  values ('nope', (select id from public.markets where slug = 'houston'), 'inbound', 'a1', 'b2') $$,
  '23514', null, 'call SIDs are validated');

insert into public.webhook_events (vendor, event_key) values ('twilio', 'voice:CA1');
select throws_ok($$ insert into public.webhook_events (vendor, event_key) values ('twilio', 'voice:CA1') $$,
  '23505', null, 'a webhook event is processed once');

insert into public.sms_messages (market_id, request_id, direction, from_phone, to_phone, body, status)
values ((select id from public.markets where slug = 'houston'), '00000000-0000-4000-8000-0000000003b1', 'outbound', '+12105550199', '+12105550102', 'Test text', 'sent');
insert into public.sms_opt_outs (phone, opted_out, source) values ('+12105550104', true, 'STOP');

-- Visitors read none of it.
set local role anon;
select throws_ok($$ select * from public.calls $$, '42501', null, 'visitors cannot read calls');
select throws_ok($$ select * from public.sms_messages $$, '42501', null, 'visitors cannot read texts');
select throws_ok($$ select * from public.webhook_events $$, '42501', null, 'visitors cannot read webhook events');
select throws_ok($$ select * from public.on_duty_dispatchers() $$, '42501', null, 'visitors cannot see who is on duty');
select ok(public.market_phone_for_source((select id from public.markets where slug = 'houston'), 'google_ads') is not distinct from
          public.market_website_phone((select id from public.markets where slug = 'houston')),
  'without a google_ads number the website number is shown');
reset role;

-- A dispatcher sees calls and texts in their market only.
select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000003a1', 'role', 'authenticated', 'aal', 'aal2',
  'app_role', 'staff', 'staff_role', 'dispatcher', 'staff_markets', jsonb_build_array((select id from public.markets where slug = 'houston'))));
select is((select count(*)::int from public.calls), 1, 'the Houston dispatcher reads the Houston call');
select is((select count(*)::int from public.sms_messages), 1, 'and its text');
select lives_ok($$ insert into public.dispatcher_status (user_id, presence, on_duty_now) values ('00000000-0000-4000-8000-0000000003a1', 'available', true) $$,
  'a dispatcher sets their own presence');
select throws_ok($$ insert into public.dispatcher_status (user_id, presence) values ('00000000-0000-4000-8000-0000000003a2', 'available') $$,
  '42501', null, 'but not someone else''s');
select throws_ok($$ insert into public.dispatcher_shifts (user_id, weekday, start_minute, end_minute) values ('00000000-0000-4000-8000-0000000003a1', 1, 0, 60) $$,
  '42501', null, 'dispatchers cannot edit the schedule');
select is((select count(*)::int from public.on_duty_dispatchers() where user_id = '00000000-0000-4000-8000-0000000003a1'), 1,
  'the "on duty now" toggle puts a dispatcher on duty');
reset role;

select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000003a2', 'role', 'authenticated', 'aal', 'aal2',
  'app_role', 'staff', 'staff_role', 'dispatcher', 'staff_markets', jsonb_build_array((select id from public.markets where slug = 'las-vegas'))));
select is((select count(*)::int from public.calls), 0, 'a Las Vegas dispatcher does not see Houston calls');
select is((select count(*)::int from public.sms_messages), 0, 'or Houston texts');
reset role;

-- Shifts: a manager adds one; the dispatcher is on duty inside it.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'ops_manager'));
select lives_ok($$ insert into public.dispatcher_shifts (user_id, weekday, start_minute, end_minute, time_zone)
  values ('00000000-0000-4000-8000-0000000003a2', extract(dow from (now() at time zone 'America/Los_Angeles'))::smallint, 0, 1440, 'America/Los_Angeles') $$,
  'a manager adds a shift');
reset role;
select is((select count(*)::int from public.on_duty_dispatchers() where user_id = '00000000-0000-4000-8000-0000000003a2'), 1,
  'a dispatcher inside a shift is on duty');

select * from finish();
rollback;
