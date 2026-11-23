-- RSOS-028: every consent links to a policy version. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(7);

select is((select count(*)::int from public.policy_versions where version = '2026-11-13-draft'), 7, 'seven documents, versioned');
select lives_ok($$ insert into public.consents (phone, consent_type, granted, policy_version, source) values ('+17135550190', 'sms_transactional', true, '2026-11-13-draft', 'test') $$,
  'an SMS consent with a known terms version is stored');
select throws_ok($$ insert into public.consents (phone, consent_type, granted, policy_version, source) values ('+17135550190', 'sms_transactional', true, '1999-01-01', 'test') $$,
  '23503', null, 'a consent with an unknown version is refused');
select is((select policy_document from public.consents where phone = '+17135550190'), 'sms-terms', 'the consent names its document');

set local role anon;
select lives_ok($$ select public.record_cookie_consent('{"browser_id":"00000000-0000-4000-8000-0000000000c1","analytics":true,"ads":true,"gpc":true,"policy_version":"2026-11-13-draft"}') $$,
  'visitors record cookie choices');
select throws_ok($$ select public.record_cookie_consent('{"browser_id":"00000000-0000-4000-8000-0000000000c2","analytics":false,"ads":false,"policy_version":"nope"}') $$,
  '23503', null, 'cookie choices need a real policy version');
reset role;
select is((select ads from public.cookie_consents where browser_id = '00000000-0000-4000-8000-0000000000c1'), false, 'Global Privacy Control turns advertising off');

select * from finish();
rollback;
