-- Runs after every staging and production deploy (db-deploy.yml), never on rsos-dev.
-- Proves the reference data is complete and that no dev seed or test data leaked in.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

select is((select count(*)::int from public.markets where slug in ('san-antonio', 'las-vegas', 'houston', 'phoenix', 'orlando')), 5, 'the five markets exist');
select is((select count(*)::int from public.services where slug in ('flat-tire', 'wont-start', 'locked-out', 'out-of-gas', 'tow', 'winch-out')), 6, 'the six services exist');
select is((select count(*)::int from public.current_market_services where enabled), 25, 'five enabled services in each of the five markets');
select is((select slug from public.market_for_point(29.4241, -98.4936)), 'san-antonio', 'San Antonio centre is in San Antonio');

select is_empty($$ select 1 from public.requests where driver_name ilike 'dev seed%' or driver_phone ~ '^\+1[0-9]{3}55501[0-9]{2}$' $$, 'no fake requests');
select is_empty($$ select 1 from public.provider_applications where company_name ilike 'dev seed%' or email ilike '%@example.test' $$, 'no fake provider applications');
select is_empty($$ select 1 from public.contact_messages where name ilike 'dev seed%' or email ilike '%@example.test' $$, 'no fake contact messages');
select is_empty($$ select 1 from public.waitlist where email ilike '%@example.test' or source = 'dev-seed' $$, 'no fake waitlist entries');
select is_empty($$ select 1 from public.markets where slug ilike 'rls-%' or slug ilike 'test-%' $$, 'no test markets');

select * from finish();
rollback;
