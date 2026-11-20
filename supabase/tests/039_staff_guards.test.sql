-- Code review 2026-11-20: staff-only functions refuse signed-in users who are not staff (a provider
-- account here: role authenticated, no staff_role claim). Before 20261121000000_staff_guards.sql
-- their guards evaluated to NULL for such users and let them through. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(15);

insert into public.providers (id, name, status) values ('00000000-0000-4000-8000-0000000121b1', 'Guard Test Towing', 'active');
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000121a1',
  'role', 'authenticated', 'aal', 'aal1', 'app_role', 'provider',
  'providers', jsonb_build_array(jsonb_build_object('provider_id', '00000000-0000-4000-8000-0000000121b1', 'role', 'owner')))::text, true);
set local role authenticated;

select ok(not public.staff_role_in('super_admin', 'ops_manager'), 'staff_role_in is false (not NULL) for non-staff');
select throws_ok($$ select public.dispatch_step(gen_random_uuid(), 'completed') $$, '42501', null, 'dispatch_step');
select throws_ok($$ select public.record_manual_test_fee('00000000-0000-4000-8000-0000000121b1', 2500, gen_random_uuid()) $$, '42501', null, 'record_manual_test_fee');
select throws_ok($$ select public.refund_job_fee(gen_random_uuid(), 'give it back') $$, '42501', null, 'refund_job_fee');
select throws_ok($$ select public.set_provider_status('00000000-0000-4000-8000-0000000121b1', 'active', null) $$, '42501', null, 'set_provider_status');
select throws_ok($$ select public.create_provider_from_application(gen_random_uuid()) $$, '42501', null, 'create_provider_from_application');
select throws_ok($$ select public.clear_review_flag(gen_random_uuid(), true) $$, '42501', null, 'clear_review_flag');
select throws_ok($$ select public.set_provider_identifier(gen_random_uuid(), 'ein', repeat('a', 64)) $$, '42501', null,
  'set_provider_identifier for another company');
select throws_ok($$ select public.add_test_traffic_rule('ip', '0.0.0.0/0', 'Everyone') $$, '42501', null, 'add_test_traffic_rule');
select throws_ok($$ select public.remove_test_traffic_rule(gen_random_uuid()) $$, '42501', null, 'remove_test_traffic_rule');
select throws_ok($$ select public.set_ad_connection('google_ads', true) $$, '42501', null, 'set_ad_connection');
select throws_ok($$ select public.map_ad_campaign('google_ads', '123', null, null) $$, '42501', null, 'map_ad_campaign');
select throws_ok($$ select public.set_question_override(null, 'tow', 'rolls', true, false, 1) $$, '42501', null, 'set_question_override');
reset role;

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosrc like '%public.jwt_staff_role() not in (%'), 0,
  'no NULL-unsafe staff guard is left');

set local role anon;
select ok((select public.test_traffic_has_ip_rules()) is not null, 'the website can ask whether the test list has IP rules');
reset role;

select * from finish();
rollback;
