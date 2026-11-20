-- RSOS-019: website menus, numbers, live proof and waitlist come from the database. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(13);

-- Test data (fake 555 numbers, rolled back).
insert into public.market_phone_numbers (market_id, phone_number, purpose)
select id, '+17135550123', 'website' from public.markets where slug = 'houston';
insert into public.market_phone_numbers (market_id, phone_number, purpose)
select id, '+17135550199', 'google_ads' from public.markets where slug = 'houston';

set local role anon;
select results_eq($$ select slug from public.list_site_markets() $$, $$ values ('houston'), ('las-vegas'), ('san-antonio') $$,
  'menus list the published (test or active) markets only');
select is((select phone from public.list_site_markets() where slug = 'houston'), '+17135550123',
  'the website number is the market''s "website" tracking number, not an ad number');
select is((select phone from public.list_site_markets() where slug = 'las-vegas'), null::text, 'no number until the owner adds one');
select is((select count(*)::int from public.list_public_services() where market_count = 3), 5, 'five services are offered in all three test markets');
select is((select market_count from public.list_public_services() where slug = 'winch-out'), 0, 'a service disabled everywhere shows as not available yet');
reset role;
-- rsos-dev keeps real test providers from e2e runs (RSOS-115 approves some): compare with them.
select set_config('test.real_providers', (select count(*)::text from public.providers p
  where p.status = 'active' and not p.is_demo
    and (select id from public.markets where slug = 'houston') = any (p.market_ids)), true);
set local role anon;
select is((select provider_count from public.market_public_stats('houston')), current_setting('test.real_providers')::int,
  'live proof counts only real providers');
reset role;
insert into public.providers (name, status, market_ids, is_demo) select 'Stats Test (demo)', 'active', array_agg(id), true from public.markets where slug = 'houston';
set local role anon;
select is((select provider_count from public.market_public_stats('houston')), current_setting('test.real_providers')::int,
  'demo companies never count as real providers');
select is((select avg_eta_minutes from public.market_public_stats('houston')), null::int, 'no average ETA without real completed jobs');
select is_empty($$ select * from public.market_public_stats('phoenix') $$, 'no stats for unpublished markets');

-- Waitlist: stored with validation; anonymous visitors still cannot read it.
select lives_ok($$ select public.join_waitlist('{"email":"wait@example.test","zip":"75201","city":"Dallas","state_code":"TX"}') $$, 'joins the waitlist');
select throws_ok($$ select public.join_waitlist('{"email":"not-an-email"}') $$, '22023', null, 'rejects a bad email');
select throws_ok($$ select * from public.waitlist $$, '42501', null, 'anonymous visitors cannot read the waitlist');
reset role;

-- AC3: adding a market in the database adds it to the menus with no code change.
insert into public.markets (slug, name, state_code, time_zone, center, boundary, status)
values ('test-city', 'Test City', 'TX', 'America/Chicago', 'SRID=4326;POINT(-97.0 31.0)',
        'SRID=4326;MULTIPOLYGON(((-97.1 30.9,-96.9 30.9,-96.9 31.1,-97.1 31.1,-97.1 30.9)))', 'test');
set local role anon;
select ok(exists (select 1 from public.list_site_markets() where slug = 'test-city'), 'a new test market appears in the menus');
reset role;

select * from finish();
rollback;
