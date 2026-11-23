-- RSOS-022/068: cancelling by status token. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(4);
create temporary table t (v text);
grant all on t to anon;
insert into t select status_token from public.create_request(jsonb_build_object('market_slug', 'houston', 'service_slug', 'tow',
  'driver_name', 'Cancel Test', 'driver_phone', '+17135550167', 'pickup', jsonb_build_object('lat', 29.76, 'lng', -95.37, 'address', 'Test')));
set local role anon;
select throws_ok($$ select public.cancel_request_by_token((select v from t), 'because') $$, '22023', null, 'reasons come from the list');
select is(public.cancel_request_by_token((select v from t), 'fixed'), true, 'the driver cancels with a reason');
select is(public.cancel_request_by_token((select v from t), 'fixed'), false, 'a cancelled request cannot be cancelled again');
reset role;
select is((select data ->> 'reason' from public.request_events e join public.requests r on r.id = e.request_id
           where r.status_token = (select v from t) and e.event_type = 'cancelled'), 'fixed', 'the reason is in the timeline');
select * from finish();
rollback;
