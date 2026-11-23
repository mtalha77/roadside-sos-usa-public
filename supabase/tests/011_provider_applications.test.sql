-- RSOS-026: provider applications and plans. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

create temporary table t_id (id uuid);
grant insert, select on t_id to anon;
set local role anon;
insert into t_id select public.submit_provider_application(jsonb_build_object(
  'company_name', 'Dev Test Towing', 'contact_name', 'Dev Tester', 'phone', '+17135550177', 'email', 'apply@example.test',
  'market_slugs', jsonb_build_array('houston', 'san-antonio', 'phoenix'), 'service_slugs', jsonb_build_array('tow', 'flat-tire'),
  'truck_count', '3', 'insurance_carrier', 'Test Mutual', 'license_number', '00000000', 'referral_source', 'Search',
  'sms_consent', true, 'sms_policy_version', '2026-11-13-draft', 'ip', '203.0.113.9', 'user_agent', 'test'));
select throws_ok($$ select public.submit_provider_application('{"company_name":"X Co","contact_name":"Ann B","phone":"+17135550178","email":"a@example.test","market_slugs":[],"service_slugs":["tow"]}') $$,
  '22023', null, 'an application needs at least one market');
select throws_ok($$ select * from public.provider_applications $$, '42501', null, 'visitors cannot read applications');
select is((select count(*)::int from public.list_market_plans() where market_slug = 'houston'), 2, 'Pro and Featured plans for Houston');
reset role;

-- AC1: stored with all fields and the markets tagged (unpublished markets ignored).
select is((select company_name || '|' || contact_name || '|' || phone || '|' || email || '|' || truck_count || '|' || insurance_carrier || '|' || license_number || '|' || referral_source
           from public.provider_applications where id = (select id from t_id)),
          'Dev Test Towing|Dev Tester|+17135550177|apply@example.test|3|Test Mutual|00000000|Search', 'every field is stored');
select is((select array(select m.slug::text from public.markets m where m.id = any (a.market_ids) order by 1)
           from public.provider_applications a where a.id = (select id from t_id)), array['houston', 'san-antonio'], 'tagged with the published markets chosen');
select is((select cardinality(service_ids) from public.provider_applications where id = (select id from t_id)), 2, 'services stored');
select is((select policy_version from public.consents where phone = '+17135550177' and consent_type = 'sms_transactional'), '2026-11-13-draft',
  'the SMS opt-in is a consent with the terms version shown');
select is((select status::text from public.provider_applications where id = (select id from t_id)), 'new', 'new applications wait for review');
select throws_ok($$ update public.market_plans set price_min_cents = 1 $$, '0A000', null, 'plan prices are append-only');

select * from finish();
rollback;
