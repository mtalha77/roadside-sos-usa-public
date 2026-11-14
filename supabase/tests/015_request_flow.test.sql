-- RSOS-021: drafts, duplicate check and web submission. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

create temporary table t (k text primary key, v text);
grant all on t to anon;
set local role anon;
insert into t values ('draft', public.save_request_draft(null, '{"step":"location","lat":29.7604,"lng":-95.3698}'));
select is(public.save_request_draft((select v from t where k = 'draft'), '{"service":"tow"}'), (select v from t where k = 'draft'), 'the same draft is updated');
select is(public.get_request_draft((select v from t where k = 'draft')) ->> 'service', 'tow', 'patches merge');
select is(public.get_request_draft((select v from t where k = 'draft')) ->> 'step', 'location', 'earlier answers stay');
select is(public.get_request_draft('not-a-token'), null::jsonb, 'unknown tokens read nothing');
select throws_ok($$ select * from public.request_drafts $$, '42501', null, 'drafts are not readable directly');
insert into t select 'req', status_token from public.submit_web_request(jsonb_build_object(
  'market_slug', 'houston', 'service_slug', 'tow', 'driver_name', 'Draft Test', 'driver_phone', '+17135550166',
  'pickup', jsonb_build_object('lat', 29.76, 'lng', -95.37, 'address', 'Test address')), (select v from t where k = 'draft'), true);
select is(public.find_recent_request('+17135550166'), (select v from t where k = 'req'), 'a second request from the same phone opens the first');
select is(public.get_request_draft((select v from t where k = 'draft')), null::jsonb, 'the draft is gone after submitting');
reset role;
select is((select driver_phone_verified from public.requests where status_token = (select v from t where k = 'req')), true, 'phone verification is recorded');

select * from finish();
rollback;
