-- RSOS-117: booking commitment. The fee is reserved at pick and charged on proof (code, GPS
-- arrival, "Yes, fixed", or an hour), released on a valid cancellation; the customer booking fee
-- is off by default, only the Owner turns it on, refunds follow the rules; the code locks; no-shows
-- and reliability; flags; who may read and do what. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(49);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_staff(r text) returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000117a1', 'role', 'authenticated',
    'aal', 'aal2', 'app_role', 'staff', 'staff_role', r));
$$;
create function pg_temp.as_owner(p uuid) returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000117a2', 'role', 'authenticated',
    'aal', 'aal1', 'app_role', 'provider',
    'providers', jsonb_build_array(jsonb_build_object('provider_id', p, 'role', 'owner'))));
$$;
create function pg_temp.req(n int) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-0000000117c' || n)::uuid
$$;
create function pg_temp.tok(n int) returns text language sql as $$
  select 'booking-commitment-test-token-00000' || n
$$;
create function pg_temp.booking(n int) returns uuid language sql as $$
  select id from public.bookings where request_id = pg_temp.req(n) order by created_at desc limit 1
$$;
create function pg_temp.hold(n int) returns text language sql as $$
  select status from public.fee_holds where request_id = pg_temp.req(n)
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.booking_fee_settings'::regclass, 'public.booking_rules'::regclass, 'public.bookings'::regclass,
  'public.booking_codes'::regclass, 'public.fee_holds'::regclass, 'public.booking_events'::regclass,
  'public.booking_payments'::regclass, 'public.booking_flags'::regclass, 'public.customer_reliability'::regclass,
  'public.spot_checks'::regclass)), 'every booking table has RLS');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000117a1', 'booking-staff@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000117a2', 'booking-owner@example.test', 'authenticated', 'authenticated');
select set_config('test.ms', (select ms.id::text from public.current_market_services ms where ms.enabled
                              order by ms.platform_fee_cents desc limit 1), true);
select set_config('test.market', (select market_id::text from public.current_market_services where id = current_setting('test.ms')::uuid), true);
select set_config('test.slug', (select slug from public.markets where id = current_setting('test.market')::uuid), true);
select set_config('test.fee', (select platform_fee_cents::text from public.current_market_services where id = current_setting('test.ms')::uuid), true);
delete from public.booking_fee_settings where market_id = current_setting('test.market')::uuid;

insert into public.providers (id, name, status, market_ids, is_demo, dispatch_phone) values
  ('00000000-0000-4000-8000-0000000117b1', 'Booking Test A', 'active', array[current_setting('test.market')::uuid], false, '+12105550170'),
  ('00000000-0000-4000-8000-0000000117b2', 'Booking Test B', 'active', array[current_setting('test.market')::uuid], false, '+12105550171');
insert into public.provider_wallets (provider_id, balance_cents) values
  ('00000000-0000-4000-8000-0000000117b1', 50000), ('00000000-0000-4000-8000-0000000117b2', 50000)
on conflict (provider_id) do update set balance_cents = 50000;

insert into public.requests (id, short_code, market_id, service_id, market_service_id, platform_fee_cents, status,
                             driver_name, driver_phone, pickup_point, pickup_address, status_token)
select pg_temp.req(n), 'R-BK' || substr('23456789', n, 1) || 'Z', ms.market_id, ms.service_id, ms.id, ms.platform_fee_cents,
       'quoted', 'Booking Test', '+1210555' || (1700 + n)::text,
       extensions.st_setsrid(extensions.st_makepoint(-98.49, 29.42), 4326)::extensions.geography, 'Test', pg_temp.tok(n)
from public.current_market_services ms, generate_series(1, 8) n
where ms.id = current_setting('test.ms')::uuid;

-- 1. Booking fee off (default): pick without paying; the fee is reserved, not charged yet.
set local role anon;
select is((select enabled from public.public_booking_fee(current_setting('test.slug'))),
  false, 'the booking fee is off by default');
select lives_ok($$ select public.book_request_by_token(pg_temp.tok(1), '00000000-0000-4000-8000-0000000117b1', 12000, 20, 'dev-1') $$,
  'the customer picks with no payment step');
select ok((select code ~ '^[0-9]{4}$' and booking_fee_cents = 0 from public.booking_for_token(pg_temp.tok(1))),
  'the tracking page gets a 4-digit code and no booking fee');
select throws_ok($$ select * from public.booking_codes $$, '42501', null, 'nobody reads codes directly');
reset role;
select is(pg_temp.hold(1), 'held', 'the provider fee is reserved at pick');
select is((select balance_cents from public.provider_wallets where provider_id = '00000000-0000-4000-8000-0000000117b1'),
  50000 - current_setting('test.fee')::int, 'the reserved fee is not spendable');
select is((select status::text from public.requests where id = pg_temp.req(1)), 'accepted', 'the request is booked');

-- 2. Provider steps: on my way, GPS arrival only near the customer, the code.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000117b2');
select throws_ok($$ select public.provider_job_step(pg_temp.booking(1), 'on_my_way') $$, '42501', null,
  'another provider cannot move the job');
reset role;
select set_config('test.code1', (select code from public.booking_codes where booking_id = pg_temp.booking(1)), true);
select pg_temp.as_owner('00000000-0000-4000-8000-0000000117b1');
select is(public.provider_job_step(pg_temp.booking(1), 'on_my_way'), 'en_route', 'On my way');
select throws_ok($$ select public.provider_job_step(pg_temp.booking(1), 'arrived', 29.50, -98.49) $$, '22023', null,
  'Arrived only within about 200 m');
select is(public.provider_job_step(pg_temp.booking(1), 'done', null, null, '99999'), 'wrong_code', 'a wrong code is refused');
select is(public.provider_job_step(pg_temp.booking(1), 'done', null, null,
          current_setting('test.code1')), 'done', 'the right code finishes the job');
reset role;
select is(pg_temp.hold(1), 'charged', 'the code charges the reserved fee');
select ok(exists (select 1 from public.booking_flags where booking_id = pg_temp.booking(1) and kind = 'done_without_arrival'),
  'done without arriving is flagged');
set local role anon;
select ok(public.answer_booking(pg_temp.tok(1), true, 5), 'the customer taps Yes, fixed and rates');
select ok(not public.answer_booking(pg_temp.tok(1), true, 4), 'the customer answers once');
reset role;

-- 3. The booking fee: only the Owner turns it on.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000117b1');
select throws_ok($$ select public.set_booking_fee(current_setting('test.market')::uuid, true, 500, 120) $$, '42501', null,
  'providers cannot change the booking fee');
reset role;
select pg_temp.as_staff('ops_manager');
select throws_ok($$ select public.set_booking_fee(current_setting('test.market')::uuid, true, 500, 120) $$, '42501', null,
  'the Operations manager cannot turn it on');
reset role;
select pg_temp.as_staff('super_admin');
select lives_ok($$ select public.set_booking_fee(current_setting('test.market')::uuid, true, 500, 120) $$, 'the Owner turns it on');
reset role;
set local role anon;
select throws_ok($$ select public.book_request_by_token(pg_temp.tok(2), '00000000-0000-4000-8000-0000000117b1', 9000, 15) $$,
  '22023', 'booking fee required', 'with the fee on, picking needs the payment');
select lives_ok($$ select public.book_request_by_token(pg_temp.tok(2), '00000000-0000-4000-8000-0000000117b1', 9000, 15, 'dev-2', true) $$,
  'the customer pays 5 USD (fake adapter)');
select ok(public.cancel_request_by_token(pg_temp.tok(2), 'found_help'), 'the customer cancels inside 2 minutes');
reset role;
select is((select booking_fee_status from public.bookings where id = pg_temp.booking(2)), 'refunded', 'free cancel: booking fee refunded');
select is(pg_temp.hold(2), 'released', 'cancel before arrival: provider fee released');
select is((select balance_cents from public.provider_wallets where provider_id = '00000000-0000-4000-8000-0000000117b1'),
  50000 - current_setting('test.fee')::int, 'the released fee is back in the wallet');

-- 4. Late cancel: fee kept, counted against the customer.
set local role anon;
select lives_ok($$ select public.book_request_by_token(pg_temp.tok(3), '00000000-0000-4000-8000-0000000117b1', 9000, 15, 'dev-3', true) $$,
  'another booking with the fee');
reset role;
update public.bookings set free_cancel_until = now() - interval '1 second' where id = pg_temp.booking(3);
set local role anon;
select ok(public.cancel_request_by_token(pg_temp.tok(3), 'other'), 'the customer cancels after the window');
reset role;
select is((select booking_fee_status from public.bookings where id = pg_temp.booking(3)), 'kept', 'after 2 minutes: no refund');
select is((select count(*)::int from public.customer_reliability where booking_id = pg_temp.booking(3) and kind = 'late_cancel'), 1,
  'the late cancel is recorded');

-- 5. Late provider: "Find me another provider", then a refund when nobody is found.
set local role anon;
select lives_ok($$ select public.book_request_by_token(pg_temp.tok(4), '00000000-0000-4000-8000-0000000117b1', 9000, 15, 'dev-4', true) $$,
  'a booking that will run late');
select ok(not public.request_backup(pg_temp.tok(4)), 'no backup button before 15 minutes late');
reset role;
update public.bookings set promised_at = now() - interval '16 minutes' where id = pg_temp.booking(4);
set local role anon;
select ok(public.request_backup(pg_temp.tok(4)), 'the customer asks for another provider');
reset role;
select is(pg_temp.hold(4), 'released', 'the late provider pays nothing');
update public.bookings set backup_requested_at = now() - interval '31 minutes' where id = pg_temp.booking(4);
select ok(public.run_booking_timers() >= 1, 'timers run');
select is((select booking_fee_status from public.bookings where id = pg_temp.booking(4)), 'refunded',
  'nobody found: booking fee refunded');

-- 6. GPS arrival charges; the 60-minute rule charges a dispatcher-assigned job.
set local role anon;
select lives_ok($$ select public.book_request_by_token(pg_temp.tok(5), '00000000-0000-4000-8000-0000000117b1', 9000, 15, 'dev-5', true) $$,
  'a booking for GPS arrival');
reset role;
select pg_temp.as_owner('00000000-0000-4000-8000-0000000117b1');
select is(public.provider_job_step(pg_temp.booking(5), 'arrived', 29.4201, -98.4901), 'on_site', 'arrived within range');
reset role;
select is(pg_temp.hold(5), 'charged', 'GPS arrival charges the fee');
select pg_temp.as_staff('dispatcher');
select lives_ok($$ select public.record_manual_test_fee('00000000-0000-4000-8000-0000000117b2', current_setting('test.fee')::int, pg_temp.req(6)) $$,
  'a dispatcher assigns a job');
reset role;
update public.fee_holds set created_at = now() - interval '61 minutes' where request_id = pg_temp.req(6);
select ok(public.run_booking_timers() >= 1, 'timers run again');
select is(pg_temp.hold(6), 'charged', 'an hour with no cancellation charges the fee');

-- 7. Customer reliability: 2 no-shows need the fee, 3 block booking.
select pg_temp.as_staff('super_admin');
select public.set_booking_fee(current_setting('test.market')::uuid, false, 500, 120);
reset role;
insert into public.customer_reliability (market_id, customer_key, kind)
select current_setting('test.market')::uuid, public.customer_key_for('+12105551707'), 'no_show' from generate_series(1, 2);
set local role anon;
select throws_ok($$ select public.book_request_by_token(pg_temp.tok(7), '00000000-0000-4000-8000-0000000117b1', 9000, 15) $$,
  '22023', 'booking fee required', '2 no-shows: the booking fee is required even when it is off');
reset role;
insert into public.customer_reliability (market_id, customer_key, kind)
values (current_setting('test.market')::uuid, public.customer_key_for('+12105551707'), 'no_show');
set local role anon;
select throws_ok($$ select public.book_request_by_token(pg_temp.tok(7), '00000000-0000-4000-8000-0000000117b1', 9000, 15, null, true) $$,
  '42501', null, '3 no-shows: blocked');
reset role;

-- 8. Provider no-show: released when GPS shows the provider there and the customer is silent.
set local role anon;
select lives_ok($$ select public.book_request_by_token(pg_temp.tok(8), '00000000-0000-4000-8000-0000000117b1', 9000, 15) $$,
  'a booking that ends in a no-show');
reset role;
-- Arrival here is recorded without charging, to test the no-show release.
update public.bookings set status = 'on_site', arrived_at = now(), provider_report = 'no_show',
       provider_report_at = now() - interval '16 minutes' where id = pg_temp.booking(8);
select ok(public.run_booking_timers() >= 1, 'timers decide the no-show');
select is(pg_temp.hold(8), 'released', 'an approved no-show releases the fee');

-- 9. Admin: flags and the held amount.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000117b1');
select throws_ok($$ select public.clear_booking_flag((select id from public.booking_flags limit 1), 'ok') $$, '42501', null,
  'providers cannot clear flags');
select is((select count(*)::int from public.booking_flags), 0, 'providers do not see flags');
reset role;

select * from finish();
rollback;
