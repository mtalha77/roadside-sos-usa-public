-- RSOS-108: the speed promise counts real bookings only and stays hidden below 10. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(4);

-- A market of its own (no other requests), with a service and a price row to point at.
insert into public.markets (id, slug, name, state_code, time_zone, center, boundary, status)
values ('00000000-0000-4000-8000-0000000108a1', 'speed-test-market', 'Speed Test', 'TX', 'America/Chicago',
        extensions.st_setsrid(extensions.st_makepoint(-97.5, 30.5), 4326)::extensions.geography,
        extensions.st_multi(extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(-97.5, 30.5), 4326), 0.05))::extensions.geography,
        'test');
insert into public.market_services (market_id, service_id, enabled, price_min_cents, price_max_cents, platform_fee_cents, effective_from)
select '00000000-0000-4000-8000-0000000108a1', s.id, true, 5000, 9000, 2250, now() - interval '1 day'
from public.services s where s.slug = 'flat-tire';

create function pg_temp.booked(n int, minutes int, phone text) returns void language sql as $$
  insert into public.requests (short_code, market_id, service_id, market_service_id, platform_fee_cents, status,
                               driver_name, driver_phone, pickup_point, pickup_address, submitted_at, accepted_at)
  select 'R-' || substr(translate(upper(md5(random()::text)), '01', '23'), 1, 5), ms.market_id, ms.service_id, ms.id, 2250, 'accepted',
         'Speed Test', phone, extensions.st_setsrid(extensions.st_makepoint(-97.5, 30.5), 4326)::extensions.geography,
         'Test', now() - interval '1 hour', now() - interval '1 hour' + make_interval(mins => minutes)
  from public.market_services ms, generate_series(1, n)
  where ms.market_id = '00000000-0000-4000-8000-0000000108a1';
$$;

-- Nine real bookings: not enough for a promise.
select pg_temp.booked(9, 4, '+12105551234');
select is((select median_minutes from public.market_booking_speed('speed-test-market')), null, 'fewer than 10 bookings: no number');
-- Fictional test numbers never count.
select pg_temp.booked(20, 30, '+12105550142');
select is((select bookings from public.market_booking_speed('speed-test-market')), 9, 'fictional test numbers are left out');
-- The tenth real booking: the median shows.
select pg_temp.booked(1, 6, '+12105551234');
select is((select median_minutes from public.market_booking_speed('speed-test-market')), 4, 'median of real bookings, in minutes');

set local role anon;
select is((select bookings from public.market_booking_speed('speed-test-market')), 10, 'visitors can read the aggregate');
reset role;

select * from finish();
rollback;
