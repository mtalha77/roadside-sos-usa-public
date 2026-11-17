-- RSOS-031: visits, ad spend, conversion events from triggers, the marketing report. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(11);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.site_visits'::regclass, 'public.ad_spend'::regclass, 'public.conversion_events'::regclass)), 'RLS on every new table');

-- Visitors count visits through the function only. (rsos-dev keeps rows from e2e runs, so the
-- test checks the increase.)
select set_config('test.visits_before', coalesce((select visits from public.site_visits
  where day = current_date and market_key = 'houston' and source = 'google_ads'), 0)::text, true);
set local role anon;
select lives_ok($$ select public.record_visit('houston', 'google_ads') $$, 'a first visit is counted');
select throws_ok($$ select * from public.site_visits $$, '42501', null, 'visitors cannot read visit counts');
select throws_ok($$ select * from public.conversion_events $$, '42501', null, 'or conversions');
reset role;
select is((select visits from public.site_visits where day = current_date and market_key = 'houston' and source = 'google_ads'),
  current_setting('test.visits_before')::int + 1, 'one visit recorded');

-- A web request with a gclid produces one request_submitted conversion carrying the gclid.
insert into public.requests (id, short_code, market_id, service_id, market_service_id, platform_fee_cents, status, channel,
                             driver_name, driver_phone, pickup_point, pickup_address)
select '00000000-0000-4000-8000-0000000006c1', 'R-ADS2', m.id, cms.service_id, cms.id, 0, 'submitted', 'web',
       'Ad Driver', '+12105550161', extensions.st_point(-95.37, 29.76)::extensions.geography, 'Test'
from public.markets m join public.current_market_services cms on cms.market_id = m.id
where m.slug = 'houston' limit 1;
insert into public.attributions (request_id, gclid, utm_source) values ('00000000-0000-4000-8000-0000000006c1', 'TEST-GCLID-1', 'google');
set constraints all immediate;
select is((select gclid from public.conversion_events where event_id = 'request_submitted:00000000-0000-4000-8000-0000000006c1'),
  'TEST-GCLID-1', 'the form conversion carries the gclid');
update public.requests set status = 'completed' where id = '00000000-0000-4000-8000-0000000006c1';
update public.requests set status = 'completed', updated_at = now() where id = '00000000-0000-4000-8000-0000000006c1';
select is((select count(*)::int from public.conversion_events where event_id = 'job_completed:00000000-0000-4000-8000-0000000006c1'), 1,
  'job_completed is recorded once (deduplicated)');

-- Calls: started on insert, qualified past 60 seconds.
insert into public.calls (id, twilio_call_sid, market_id, direction, source, from_phone, to_phone)
values ('00000000-0000-4000-8000-0000000006d1', 'CA' || repeat('c', 32), (select id from public.markets where slug = 'houston'),
        'inbound', 'google_ads', '+12105550162', '+12105550163');
update public.calls set duration_sec = 75 where id = '00000000-0000-4000-8000-0000000006d1';
select is((select count(*)::int from public.conversion_events where call_id = '00000000-0000-4000-8000-0000000006d1'), 2,
  'a 75-second call is started and qualified');

-- Marketing reads the report and enters spend; a dispatcher cannot enter spend.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'marketing'));
select lives_ok($$ insert into public.ad_spend (day, market_id, channel, amount_cents) values (current_date, (select id from public.markets where slug = 'houston'), 'google_ads', 5000) $$,
  'marketing enters ad spend');
select ok((select qualified_calls from public.marketing_report(current_date, current_date) where market_slug = 'houston' and source = 'google_ads') >= 1,
  'the report counts the qualified call');
reset role;
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'dispatcher'));
select throws_ok($$ insert into public.ad_spend (day, market_id, channel, amount_cents) values (current_date - 1, (select id from public.markets where slug = 'houston'), 'meta', 100) $$,
  '42501', null, 'dispatchers cannot enter spend');
reset role;

select * from finish();
rollback;
