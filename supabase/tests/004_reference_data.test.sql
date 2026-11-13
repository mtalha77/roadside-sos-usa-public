-- RSOS-017: reference data (markets, boundaries, services, prices, fees). Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(21);

-- Markets and statuses.
select results_eq($$ select slug::text, status::text from public.markets where slug in ('san-antonio','las-vegas','houston','phoenix','orlando') order by slug $$,
  $$ values ('houston','test'), ('las-vegas','test'), ('orlando','paused'), ('phoenix','paused'), ('san-antonio','test') $$, 'five markets with their statuses');
select results_eq($$ select slug::text, time_zone from public.markets where slug in ('san-antonio','las-vegas','houston','phoenix','orlando') order by slug $$,
  $$ values ('houston','America/Chicago'), ('las-vegas','America/Los_Angeles'), ('orlando','America/New_York'), ('phoenix','America/Phoenix'), ('san-antonio','America/Chicago') $$, 'correct time zones');

-- A point inside each market returns that market (RSOS-016 AC1 with the real seeds).
select is((select slug from public.market_for_point(29.4241, -98.4936)), 'san-antonio', 'downtown San Antonio');
select is((select slug from public.market_for_point(29.7030, -98.1245)), 'san-antonio', 'New Braunfels (Comal County) is in the San Antonio market');
select is((select slug from public.market_for_point(36.1699, -115.1398)), 'las-vegas', 'downtown Las Vegas');
select is((select slug from public.market_for_point(29.7604, -95.3698)), 'houston', 'downtown Houston');
select is((select slug from public.market_for_point(30.3119, -95.4561)), 'houston', 'Conroe (Montgomery County) is in the Houston market');
select is((select slug from public.market_for_point(29.5844, -95.7600)), 'houston', 'Sugar Land area (Fort Bend County) is in the Houston market');
select is((select slug from public.market_for_point(33.4484, -112.0740)), 'phoenix', 'downtown Phoenix');
select is((select slug from public.market_for_point(28.5384, -81.3789)), 'orlando', 'downtown Orlando');
select is((select slug from public.market_for_point(28.2920, -81.4076)), 'orlando', 'Kissimmee (Osceola County) is in the Orlando market');
select is_empty($$ select * from public.market_for_point(32.7767, -96.7970) $$, 'Dallas is outside every market');
select is_empty($$ select * from public.market_for_point(30.2672, -97.7431) $$, 'Austin is outside every market');

-- Services, prices and fees.
select is((select count(*)::int from public.services where slug in ('flat-tire','wont-start','locked-out','out-of-gas','tow','winch-out')), 6, 'six services');
select is((select count(*)::int from public.current_market_services c join public.markets m on m.id = c.market_id where m.slug = 'houston' and c.enabled), 5, 'five enabled services per market');
select results_eq($$ select s.slug::text, c.price_min_cents, c.price_max_cents, c.platform_fee_cents from public.current_market_services c
                     join public.services s on s.id = c.service_id join public.markets m on m.id = c.market_id
                     where m.slug = 'san-antonio' and c.enabled order by s.sort_order $$,
  $$ values ('flat-tire', 5000, 16000, 2250), ('wont-start', 5000, 15000, 2250), ('locked-out', 5000, 17000, 2750), ('out-of-gas', 5000, 19000, 2250), ('tow', 8200, 13000, 4250) $$,
  'price ranges and fees match the spec');
select is((select c.price_note from public.current_market_services c join public.services s on s.id = c.service_id join public.markets m on m.id = c.market_id where m.slug = 'las-vegas' and s.slug = 'tow'), 'plus_per_mile', 'tow notes per-mile pricing');
select ok((select not c.enabled and c.platform_fee_cents is null from public.current_market_services c join public.services s on s.id = c.service_id join public.markets m on m.id = c.market_id where m.slug = 'orlando' and s.slug = 'winch-out'), 'winch out is disabled with no fee until reviewed');
select ok((select needs_destination from public.services where slug = 'tow') and (select needs_destination from public.services where slug = 'winch-out'), 'tow and winch out need a destination');
select is((select count(*)::int from public.list_public_markets() where slug in ('san-antonio','las-vegas','houston')), 3, 'test markets are published');
select is((select count(*)::int from public.list_public_markets() where slug in ('phoenix','orlando')), 0, 'paused markets are not published');

select * from finish();
rollback;
