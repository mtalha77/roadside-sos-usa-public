-- RSOS-115: wallet bonus credits. Signup bonus on approval, spend order, limits, campaign cap,
-- duplicate businesses, reversal, expiry, refunds and who reads what. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(26);

create function pg_temp.as_staff(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000115a1',
    'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true),
    set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_owner(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'aal', 'aal1', 'app_role', 'provider', 'providers',
    jsonb_build_array(jsonb_build_object('provider_id', p, 'role', 'owner')))::text, true),
    set_config('role', 'authenticated', true);
$$;
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000115a1', 'credits@example.test', 'authenticated', 'authenticated');
select set_config('test.market', (select id::text from public.markets where slug = 'houston'), true);

-- Providers (fictional): one new, three for the campaign, two sharing an EIN.
insert into public.providers (id, name, status, market_ids) values
  ('00000000-0000-4000-8000-0000000115b1', 'Credit Test New', 'onboarding', array[current_setting('test.market')::uuid]),
  ('00000000-0000-4000-8000-0000000115b2', 'Credit Test Two', 'active', array[current_setting('test.market')::uuid]),
  ('00000000-0000-4000-8000-0000000115b3', 'Credit Test Three', 'active', array[current_setting('test.market')::uuid]),
  ('00000000-0000-4000-8000-0000000115b4', 'Credit Test Four', 'active', array[current_setting('test.market')::uuid]),
  ('00000000-0000-4000-8000-0000000115b5', 'Credit Test Dupe', 'onboarding', array[current_setting('test.market')::uuid]);
insert into public.provider_identifiers (provider_id, kind, value_hash) values
  ('00000000-0000-4000-8000-0000000115b2', 'ein', repeat('a', 64)),
  ('00000000-0000-4000-8000-0000000115b5', 'ein', repeat('a', 64));

-- Signup bonus: set by the owner, granted on approval only.
select pg_temp.as_staff('super_admin');
select lives_ok($$ select public.set_signup_bonus(current_setting('test.market')::uuid, true, 5000, 60, null, null) $$,
  'the owner sets a 50 USD signup bonus');
reset role;
select is((select count(*)::int from public.bonus_grants where provider_id = '00000000-0000-4000-8000-0000000115b1'), 0,
  'nothing at sign-up');
update public.providers set status = 'active' where id = '00000000-0000-4000-8000-0000000115b1';
select is((select amount_cents from public.bonus_grants where provider_id = '00000000-0000-4000-8000-0000000115b1' and source = 'signup'), 5000,
  'granted on approval');
update public.providers set status = 'paused' where id = '00000000-0000-4000-8000-0000000115b1';
update public.providers set status = 'active' where id = '00000000-0000-4000-8000-0000000115b1';
select is((select count(*)::int from public.bonus_grants where provider_id = '00000000-0000-4000-8000-0000000115b1'), 1,
  'once per business');
select is((select count(*)::int from public.provider_notices where provider_id = '00000000-0000-4000-8000-0000000115b1' and kind = 'bonus_welcome'), 1,
  'a welcome notice');

-- Duplicate business: flagged for review, not silently refused.
update public.providers set status = 'active' where id = '00000000-0000-4000-8000-0000000115b5';
select is((select count(*)::int from public.bonus_grants where provider_id = '00000000-0000-4000-8000-0000000115b5'), 0,
  'a duplicate gets no automatic bonus');
select is((select status from public.provider_review_flags where provider_id = '00000000-0000-4000-8000-0000000115b5'), 'open',
  'and is flagged for review');

-- The owner of the new provider sees both balances; another provider sees nothing.
select pg_temp.as_owner('00000000-0000-4000-8000-0000000115b1');
select is((select bonus_cents from public.wallet_summary('00000000-0000-4000-8000-0000000115b1')), 5000, 'the owner sees 50 USD bonus credit');
select is((select paid_cents from public.wallet_summary('00000000-0000-4000-8000-0000000115b1')), 0, 'and 0 paid balance');
select is((select count(*)::int from public.wallet_summary('00000000-0000-4000-8000-0000000115b2')), 0, 'not another company''s wallet');
reset role;

-- Spend order: a second, sooner-expiring grant is used first; then the paid balance.
select public.create_bonus_grant('00000000-0000-4000-8000-0000000115b1', 'manual', 1000, now() + interval '5 days', 'test', null);
select results_eq($$ select bonus_cents, paid_cents from public.charge_wallet('00000000-0000-4000-8000-0000000115b1', 3250, null) $$,
  $$ values (3250, 0) $$, 'a 32.50 USD fee comes from bonus credit');
select is((select remaining_cents from public.bonus_grants where provider_id = '00000000-0000-4000-8000-0000000115b1' and source = 'manual'), 0,
  'the soonest expiring grant goes first');
select results_eq($$ select bonus_cents, paid_cents from public.charge_wallet('00000000-0000-4000-8000-0000000115b1', 4000, null) $$,
  $$ values (2750, 1250) $$, 'then the rest of the credit, then the paid balance');

-- A won job: the dispatcher assigns, the fee is taken from bonus credit and tied to the request.
insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone)
values ('00000000-0000-4000-8000-0000000115c1', 'R-CRD1', current_setting('test.market')::uuid, 2500, 'phone_intake', 'phone', 'Caller', '+12105550143');
select public.create_bonus_grant('00000000-0000-4000-8000-0000000115b4', 'manual', 5000, now() + interval '30 days', 'test', null);
select pg_temp.as_staff('dispatcher');
select lives_ok($$ select public.record_manual_test_fee('00000000-0000-4000-8000-0000000115b4', 2500, '00000000-0000-4000-8000-0000000115c1') $$,
  'assigning a job records its fee');
reset role;
select is((select -sum(amount_cents)::int from public.wallet_ledger where request_id = '00000000-0000-4000-8000-0000000115c1' and kind = 'bonus_use'), 2500,
  'the fee is taken from bonus credit');
-- Refund: the credit part comes back as bonus credit with at least 14 days.
select pg_temp.as_staff('finance');
select lives_ok($$ select public.refund_job_fee('00000000-0000-4000-8000-0000000115c1', 'approved dispute') $$, 'finance refunds a disputed fee');
reset role;
select ok((select expires_at >= now() + interval '14 days' from public.bonus_grants
            where provider_id = '00000000-0000-4000-8000-0000000115b4' and source = 'refund'),
  'it returns as bonus credit with its expiry or 14 days, whichever is later');

-- Approval limits.
select pg_temp.as_staff('ops_manager');
select throws_ok($$ select public.grant_bonus_credit('00000000-0000-4000-8000-0000000115b2', 15000, 60, 'goodwill') $$, '42501', null,
  'an operations manager cannot grant 150 USD');
select lives_ok($$ select public.grant_bonus_credit('00000000-0000-4000-8000-0000000115b2', 5000, 60, 'goodwill') $$,
  'but can grant 50 USD');
select throws_ok($$ select public.grant_bonus_credit('00000000-0000-4000-8000-0000000115b2', 5000, 60, 'other') $$, '23514', null,
  '"other" needs a note');

-- Campaign: the budget cap stops it, never a partial grant.
select results_eq($$ select granted, left_out, total_cents from public.run_credit_campaign('Test campaign', current_setting('test.market')::uuid,
    null, null, array['00000000-0000-4000-8000-0000000115b2', '00000000-0000-4000-8000-0000000115b3', '00000000-0000-4000-8000-0000000115b4']::uuid[],
    2000, 30, 'Thanks for joining', 5000) $$,
  $$ values (2, 1, 4000) $$, 'a 50 USD budget gives 2 of 3 providers 20 USD');
select throws_ok($$ select public.reverse_bonus_credit((select id from public.bonus_grants where source = 'campaign' limit 1), 'fraud test') $$,
  '42501', null, 'only the owner reverses credit');
reset role;

-- Reversal and expiry by the owner.
select pg_temp.as_staff('super_admin');
select is((select public.reverse_bonus_credit((select id from public.bonus_grants where source = 'campaign' order by created_at limit 1), 'fraud test')), 2000,
  'the owner removes unused credit');
reset role;
insert into public.bonus_grants (provider_id, source, reason, amount_cents, remaining_cents, expires_at)
values ('00000000-0000-4000-8000-0000000115b3', 'manual', 'test', 700, 700, now() - interval '1 minute');
select pg_temp.as_staff('super_admin');
select ok((select public.expire_bonus_credits()) >= 1, 'the expiry job runs');
reset role;
select is((select -amount_cents from public.wallet_ledger where provider_id = '00000000-0000-4000-8000-0000000115b3' and kind = 'bonus_expiry'), 700,
  'and the ledger shows the expiry');

-- Who reads what.
select pg_temp.as_staff('dispatcher');
select is((select count(*)::int from public.bonus_grants where provider_id = '00000000-0000-4000-8000-0000000115b1'), 0,
  'dispatchers do not read credits');
reset role;

select * from finish();
rollback;
