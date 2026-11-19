-- RSOS-109: Instant book on real requests: switching by the status link, the ceiling as a hard
-- rule for manual dispatch, and the recorded outcome. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

insert into public.requests (id, short_code, market_id, service_id, market_service_id, platform_fee_cents, status,
                             driver_name, driver_phone, pickup_point, pickup_address, status_token)
select '00000000-0000-4000-8000-0000000109a1', 'R-XQ2KZ', ms.market_id, ms.service_id, ms.id, 2250, 'submitted',
       'Instant Test', '+12105551234', extensions.st_setsrid(extensions.st_makepoint(-98.49, 29.42), 4326)::extensions.geography,
       'Test', 'instant-book-test-token-000000000001'
from public.current_market_services ms join public.markets m on m.id = ms.market_id
where ms.enabled limit 1;

set local role anon;
select ok(public.set_booking_mode('instant-book-test-token-000000000001', 'instant', 9000), 'the customer switches to Instant book');
select ok(not public.set_booking_mode('instant-book-test-token-000000000001', 'instant', null), 'Instant book needs a ceiling');
select ok(not public.set_booking_mode('short', 'compare', null), 'a wrong link changes nothing');
reset role;
select is((select instant_max_cents from public.requests where id = '00000000-0000-4000-8000-0000000109a1'), 9000, 'the ceiling is saved');
select is((select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-0000000109a1' and event_type = 'booking_mode'),
  1, 'the choice is recorded for analytics');

-- Manual dispatch cannot book above the ceiling; at the ceiling it books and records the outcome.
select throws_ok($$ update public.requests set status = 'assigned', quoted_price_cents = 9500
                    where id = '00000000-0000-4000-8000-0000000109a1' $$, '22023', null, 'a higher price never books');
update public.requests set status = 'assigned', quoted_price_cents = 9000 where id = '00000000-0000-4000-8000-0000000109a1';
select is((select booking_outcome from public.requests where id = '00000000-0000-4000-8000-0000000109a1'), 'booked', 'booked at the ceiling');
set local role anon;
select ok(not public.set_booking_mode('instant-book-test-token-000000000001', 'compare', null), 'no switching after a booking');
reset role;

select * from finish();
rollback;
