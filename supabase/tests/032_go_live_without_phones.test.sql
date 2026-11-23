-- RSOS-110: a market goes live with no phone numbers: calls are optional, the booking flow is not.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(5);

insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000110a1', 'golive@example.test', 'authenticated', 'authenticated');
create function pg_temp.as_ops() returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000110a1', 'role', 'authenticated',
    'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'ops_manager')::text, true), set_config('role', 'authenticated', true);
$$;

-- A market with one service, priced, one real provider, a landing page and a conversion: no numbers.
insert into public.markets (id, slug, name, state_code, time_zone, center, boundary, status, min_providers_per_service)
values ('00000000-0000-4000-8000-0000000110b1', 'golive-test-market', 'Go Live Test', 'TX', 'America/Chicago',
        extensions.st_setsrid(extensions.st_makepoint(-96.5, 31.5), 4326)::extensions.geography,
        extensions.st_multi(extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(-96.5, 31.5), 4326), 0.05))::extensions.geography,
        'test', 1);
insert into public.market_services (market_id, service_id, enabled, price_min_cents, price_max_cents, platform_fee_cents, effective_from)
select '00000000-0000-4000-8000-0000000110b1', s.id, true, 5000, 9000, 2250, now() - interval '1 day'
from public.services s where s.slug = 'flat-tire';
insert into public.providers (id, name, status, market_ids)
values ('00000000-0000-4000-8000-0000000110c1', 'Go Live Test Towing', 'active', array['00000000-0000-4000-8000-0000000110b1'::uuid]);
insert into public.provider_service_prices (provider_id, market_id, service_id, price_cents)
select '00000000-0000-4000-8000-0000000110c1', '00000000-0000-4000-8000-0000000110b1', s.id, 7000 from public.services s where s.slug = 'flat-tire';
insert into public.market_pages (market_id, locale, headline, intro)
values ('00000000-0000-4000-8000-0000000110b1', 'en', 'Roadside help in Go Live Test',
        repeat('Fast roadside help from verified local providers, booked online in about a minute. ', 2));
insert into public.conversion_events (event_id, name, market_id) values ('golive-test:1', 'request_submitted', '00000000-0000-4000-8000-0000000110b1');
-- Release 1: Sentry live in all three apps is required too (recorded by the admin app).
insert into public.platform_checks (key, ok, checked_at) values ('sentry', true, now())
  on conflict (key) do update set ok = true, checked_at = now();

select pg_temp.as_ops();
select ok((select not ok from public.market_launch_checklist('00000000-0000-4000-8000-0000000110b1') where item = 'numbers')
          and (select not required from public.market_launch_checklist('00000000-0000-4000-8000-0000000110b1') where item = 'numbers'),
  'phone numbers are missing, and optional');
select throws_ok($$ select public.set_market_status('00000000-0000-4000-8000-0000000110b1', 'active') $$, '22023', null,
  'without a tested booking the market cannot go live');
reset role;

-- The end-to-end booking test: a request that reached a provider, then cancelled as "test".
insert into public.requests (short_code, market_id, service_id, market_service_id, platform_fee_cents, status,
                             driver_name, driver_phone, pickup_point, pickup_address, accepted_at, cancelled_at, end_reason)
select 'R-GLTZ7', ms.market_id, ms.service_id, ms.id, 2250, 'cancelled', 'Booking Test', '+12105551234',
       extensions.st_setsrid(extensions.st_makepoint(-96.5, 31.5), 4326)::extensions.geography, 'Test',
       now() - interval '1 hour', now() - interval '50 minutes', 'test'
from public.market_services ms where ms.market_id = '00000000-0000-4000-8000-0000000110b1';

select pg_temp.as_ops();
select ok((select ok from public.market_launch_checklist('00000000-0000-4000-8000-0000000110b1') where item = 'booking_test'),
  'the tested booking is counted');
select lives_ok($$ select public.set_market_status('00000000-0000-4000-8000-0000000110b1', 'active') $$,
  'the market goes live with no phone numbers');
reset role;
select is((select status::text from public.markets where id = '00000000-0000-4000-8000-0000000110b1'), 'active', 'it is live');

select * from finish();
rollback;
