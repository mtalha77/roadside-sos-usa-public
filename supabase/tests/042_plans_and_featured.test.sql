-- RSOS-114: plans and Featured. No offers without a plan, the Pro fee discount and first look,
-- upgrades and downgrades, Featured slots and the waitlist, price changes with notice and
-- grandfathering, the Basic minimum, renewals, and who may read and change what. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(36);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_staff(r text) returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000114a1', 'role', 'authenticated',
    'aal', 'aal2', 'app_role', 'staff', 'staff_role', r));
$$;
create function pg_temp.as_owner(p uuid) returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000114a2', 'role', 'authenticated',
    'aal', 'aal1', 'app_role', 'provider',
    'providers', jsonb_build_array(jsonb_build_object('provider_id', p, 'role', 'owner'))));
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.plan_catalog'::regclass, 'public.plan_prices'::regclass, 'public.featured_settings'::regclass,
  'public.plan_offers'::regclass, 'public.provider_subscriptions'::regclass, 'public.subscription_charges'::regclass)),
  'every plan table has RLS');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000114a1', 'plans-staff@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000114a2', 'plans-owner@example.test', 'authenticated', 'authenticated');
select set_config('test.market', (select id::text from public.markets where slug = 'houston'), true);
select set_config('test.tow', (select id::text from public.services where slug = 'tow'), true);

-- Three providers priced for tows near downtown: A (no plan yet), B (Basic), C (Pro later).
insert into public.providers (id, name, status, market_ids, is_demo, dispatch_phone, base_point, service_radius_miles) values
  ('00000000-0000-4000-8000-0000000114b1', 'Plan Test A', 'active', array[current_setting('test.market')::uuid], false,
   '+12105550160', extensions.st_point(-95.37, 29.76)::extensions.geography, 25),
  ('00000000-0000-4000-8000-0000000114b2', 'Plan Test B', 'active', array[current_setting('test.market')::uuid], false,
   '+12105550161', extensions.st_point(-95.37, 29.76)::extensions.geography, 25),
  ('00000000-0000-4000-8000-0000000114b3', 'Plan Test C', 'active', array[current_setting('test.market')::uuid], false,
   '+12105550162', extensions.st_point(-95.37, 29.76)::extensions.geography, 25);
insert into public.provider_service_prices (provider_id, market_id, service_id, price_cents)
select p, current_setting('test.market')::uuid, current_setting('test.tow')::uuid, 12500
from unnest(array['00000000-0000-4000-8000-0000000114b1', '00000000-0000-4000-8000-0000000114b2',
                  '00000000-0000-4000-8000-0000000114b3']::uuid[]) p;
insert into public.provider_subscriptions (provider_id, plan, market_id, price_cents) values
  ('00000000-0000-4000-8000-0000000114b2', 'basic', current_setting('test.market')::uuid, 2000),
  ('00000000-0000-4000-8000-0000000114b3', 'basic', current_setting('test.market')::uuid, 2000);
insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone)
values ('00000000-0000-4000-8000-0000000114c1', 'R-PZQ7X', current_setting('test.market')::uuid, 0, 'phone_intake', 'phone',
        'Caller', '+12105550163');
update public.requests set service_id = current_setting('test.tow')::uuid,
  pickup_point = extensions.st_point(-95.40, 29.75)::extensions.geography, pickup_address = 'Test address'
where id = '00000000-0000-4000-8000-0000000114c1';

-- No free plan: A gets no requests.
select pg_temp.as_staff('dispatcher');
select ok(not exists (select 1 from public.nearby_providers('00000000-0000-4000-8000-0000000114c1')
                       where provider_id = '00000000-0000-4000-8000-0000000114b1'), 'no plan, no offers');
select ok(exists (select 1 from public.nearby_providers('00000000-0000-4000-8000-0000000114c1')
                   where provider_id = '00000000-0000-4000-8000-0000000114b2' and plan = 'basic'), 'Basic gets offers');
reset role;

-- Starting, upgrading and downgrading.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b1');
select throws_ok($$ select public.start_plan('00000000-0000-4000-8000-0000000114b2', 'pro') $$, '42501', null,
  'an owner cannot change another provider''s plan');
select lives_ok($$ select public.start_plan('00000000-0000-4000-8000-0000000114b1', 'basic') $$, 'an owner starts Basic');
select is((select count(*)::int from public.subscription_charges where provider_id = '00000000-0000-4000-8000-0000000114b1'
           and kind = 'period' and amount_cents = 2000), 1, 'the first month is charged (fake billing)');
select is((select count(*)::int from public.provider_subscriptions), 1, 'owners see only their own subscriptions');
reset role;
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b3');
select lives_ok($$ select public.start_plan('00000000-0000-4000-8000-0000000114b3', 'pro') $$, 'C upgrades to Pro');
reset role;
select is(public.provider_plan('00000000-0000-4000-8000-0000000114b3'), 'pro', 'the upgrade is immediate');
select ok((select amount_cents > 0 and amount_cents <= 10900 from public.subscription_charges
           where provider_id = '00000000-0000-4000-8000-0000000114b3' and kind = 'prorata'), 'pro rata difference charged');

-- Pro: first look and the fee discount.
select pg_temp.as_staff('dispatcher');
select is((select offer_delay_sec from public.nearby_providers('00000000-0000-4000-8000-0000000114c1')
           where provider_id = '00000000-0000-4000-8000-0000000114b3'), 0, 'Pro sees new requests at once');
select is((select offer_delay_sec from public.nearby_providers('00000000-0000-4000-8000-0000000114c1')
           where provider_id = '00000000-0000-4000-8000-0000000114b2'), 15, 'others wait 15 seconds when a Pro is in range');
select is((select provider_id from public.nearby_providers('00000000-0000-4000-8000-0000000114c1') limit 1),
          '00000000-0000-4000-8000-0000000114b3'::uuid, 'Pro is listed first');
select lives_ok($$ select public.record_manual_test_fee('00000000-0000-4000-8000-0000000114b3', 4250,
                                                        '00000000-0000-4000-8000-0000000114c1') $$, 'a job fee is recorded');
reset role;
select is((select amount_cents from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000114b3'
           and request_id = '00000000-0000-4000-8000-0000000114c1'), 3613, 'Pro pays 15% less per job');
select is(public.offer_delay_seconds('00000000-0000-4000-8000-0000000114b2', false), 0,
  'everyone gets the offer at once when no Pro is in range');
select is(public.offer_delay_seconds('00000000-0000-4000-8000-0000000114b2', true, true), 0,
  'Instant book above the price limit never waits');

-- Downgrade waits for the end of the paid month, then renewal applies it.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b3');
select lives_ok($$ select public.start_plan('00000000-0000-4000-8000-0000000114b3', 'basic') $$, 'C schedules a downgrade');
reset role;
select is(public.provider_plan('00000000-0000-4000-8000-0000000114b3'), 'pro', 'Pro stays until the end of the month');
update public.provider_subscriptions set current_period_end = now() - interval '1 minute'
 where provider_id = '00000000-0000-4000-8000-0000000114b3' and status = 'active';
select ok(public.run_plan_renewals() >= 1, 'renewals run');
select is(public.provider_plan('00000000-0000-4000-8000-0000000114b3'), 'basic', 'the downgrade applies at renewal');

-- Featured: slots, then the waitlist; needs a base plan.
insert into public.featured_settings (market_id, slots) values (current_setting('test.market')::uuid, 1)
on conflict (market_id) do update set slots = 1;
delete from public.provider_subscriptions where plan = 'featured' and market_id = current_setting('test.market')::uuid;
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b2');
select is(public.join_featured('00000000-0000-4000-8000-0000000114b2', current_setting('test.market')::uuid), 'active',
  'the first buyer gets the slot');
reset role;
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b1');
select is(public.join_featured('00000000-0000-4000-8000-0000000114b1', current_setting('test.market')::uuid), 'waitlist',
  'when the slots are full, the next buyer joins the waitlist');
reset role;

-- Price changes: the Basic minimum, notice, grandfathering, and staff only.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b1');
select throws_ok($$ select * from public.set_plan_price('pro', null, 9900, now(), false) $$, '42501', null,
  'providers cannot change prices');
reset role;
select pg_temp.as_staff('ops_manager');
select throws_ok($$ select * from public.set_plan_price('basic', current_setting('test.market')::uuid, 1000, now(), false) $$,
  '22023', null, 'Basic costs at least 20 USD');
select ok((select bool_and(applies_from >= now() + interval '30 days')
           from public.set_plan_price('basic', current_setting('test.market')::uuid, 2500, now(), false, 30, true)),
  'existing subscribers move only after 30 days notice (preview)');
select is((select count(*)::int from public.plan_prices where price_cents = 2500), 0, 'a preview changes nothing');
select lives_ok($$ select * from public.set_plan_price('basic', current_setting('test.market')::uuid, 2500, now(), true) $$,
  'a new Basic price with existing subscribers grandfathered');
reset role;
select is(public.plan_price('basic', current_setting('test.market')::uuid), 2500, 'new subscribers pay the new price');
select ok((select bool_and(grandfathered and price_cents = 2000 and next_price_cents is null)
           from public.provider_subscriptions where plan = 'basic' and status = 'active'
             and market_id = current_setting('test.market')::uuid
             and provider_id in ('00000000-0000-4000-8000-0000000114b1', '00000000-0000-4000-8000-0000000114b2')),
  'grandfathered subscribers keep paying the old price');

-- Members see their own company's markets only.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000114b1');
select is((select count(*)::int from public.my_markets()), 1, 'a member sees their company''s market');
select ok((select bool_and(provider_id = '00000000-0000-4000-8000-0000000114b1') from public.my_markets()),
  'and no other company''s');
reset role;

-- Visitors read the public catalog only.
set local role anon;
select is((select price_cents from public.public_plan_catalog('houston') where plan = 'basic'), 2500,
  'the public catalog shows the current price');
select throws_ok($$ select public.start_plan('00000000-0000-4000-8000-0000000114b1', 'pro') $$, '42501', null,
  'visitors cannot start plans');
select ok(exists (select 1 from public.featured_providers('houston') where name = 'Plan Test B'),
  'the city page lists Featured providers');
select is((select price_rule_pct from public.featured_rules('houston')), 15, 'the placement rules are public');
reset role;

select * from finish();
rollback;
