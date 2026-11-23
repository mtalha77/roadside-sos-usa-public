-- RSOS-107: ad sync tables. Who switches platforms and maps campaigns, the dashboard prefers
-- imported spend over the manual form, auto-pause rules are off by default, and visitors and
-- dispatchers read nothing. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(11);

create function pg_temp.as_staff(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000107a1',
    'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true),
    set_config('role', 'authenticated', true);
$$;
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000107a1', 'ads@example.test', 'authenticated', 'authenticated');
select set_config('test.market', (select id::text from public.markets where slug = 'houston'), true);

select is((select count(*)::int from public.ad_connections where not enabled), 3, 'three platforms, all off until switched on');

select pg_temp.as_staff('dispatcher');
select throws_ok($$ select public.set_ad_connection('meta', true) $$, '42501', null, 'dispatchers cannot switch a platform on');
select is((select count(*)::int from public.ad_connections), 0, 'dispatchers do not see connections');
reset role;

select pg_temp.as_staff('marketing');
select lives_ok($$ select public.set_ad_connection('meta', true) $$, 'marketing switches a platform on');
select lives_ok($$ select public.set_market_ad_code(current_setting('test.market')::uuid, 'tq') $$, 'marketing sets a market code');
reset role;
select is((select ad_code from public.markets where id = current_setting('test.market')::uuid), 'TQ', 'codes are stored in capitals');

-- Imported spend wins over the manual form for the same day, market and channel.
insert into public.ad_spend (day, market_id, channel, amount_cents)
values ('2020-01-02', current_setting('test.market')::uuid, 'google_ads', 99999),
       ('2020-01-03', current_setting('test.market')::uuid, 'google_ads', 5000)
on conflict (day, market_id, channel) do update set amount_cents = excluded.amount_cents;
insert into public.ad_spend_daily (platform, campaign_id, day, market_id, spend_cents, clicks)
values ('google_ads', 'test-c1', '2020-01-02', current_setting('test.market')::uuid, 1200, 9);
select pg_temp.as_staff('marketing');
select is((select spend_cents::int from public.ad_dashboard('2020-01-02', '2020-01-02') where channel = 'google_ads'
           and market_id = current_setting('test.market')::uuid), 1200, 'imported spend replaces the manual entry');
select is((select spend_source from public.ad_dashboard('2020-01-03', '2020-01-03') where channel = 'google_ads'
           and market_id = current_setting('test.market')::uuid), 'manual', 'the manual form fills a day with no import');
reset role;

select pg_temp.as_staff('ops_manager');
select lives_ok($$ select public.set_ad_pause_rule(current_setting('test.market')::uuid, true, 1, 10, 6, 22) $$,
  'an operations manager sets an auto-pause rule');
reset role;

set local role anon;
select throws_ok($$ select count(*) from public.ad_spend_daily $$, '42501', null, 'visitors cannot read ad data');
select throws_ok($$ select * from public.ad_dashboard('2020-01-01', '2020-01-02') $$, '42501', null, 'visitors cannot run the dashboard');
reset role;

select * from finish();
rollback;
