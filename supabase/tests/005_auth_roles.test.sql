-- RSOS-018: roles, claims and policies. Simulates signed-in users with request.jwt.claims. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(19);

-- Fixtures: one request in Houston and one in San Antonio (seeded markets), a provider with a wallet.
create temporary table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
insert into t_ids select 'houston', request_id from public.create_request(jsonb_build_object(
  'market_slug', 'houston', 'service_slug', 'flat-tire', 'driver_name', 'RLS Test Houston', 'driver_phone', '+17135550142',
  'pickup', jsonb_build_object('lat', 29.76, 'lng', -95.37, 'address', 'RLS test address')));
insert into t_ids select 'san-antonio', request_id from public.create_request(jsonb_build_object(
  'market_slug', 'san-antonio', 'service_slug', 'flat-tire', 'driver_name', 'RLS Test San Antonio', 'driver_phone', '+12105550143',
  'pickup', jsonb_build_object('lat', 29.42, 'lng', -98.49, 'address', 'RLS test address')));
insert into public.providers (id, name, status) values ('00000000-0000-4000-8000-0000000000b1', 'RLS Test Towing', 'active');
insert into public.provider_wallets (provider_id, balance_cents) values ('00000000-0000-4000-8000-0000000000b1', 10000);
insert into public.provider_billing_events (provider_id, kind, amount_cents) values ('00000000-0000-4000-8000-0000000000b1', 'top_up', 10000);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;
create function pg_temp.visible_requests() returns int language sql as $$
  select count(*)::int from public.requests where id in (select v from t_ids);
$$;

-- AC1: a dispatcher limited to Houston cannot read San Antonio requests.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff',
  'staff_role', 'dispatcher', 'staff_markets', jsonb_build_array((select id from public.markets where slug = 'houston'))));
select is((select count(*)::int from public.requests where id = (select v from t_ids where k = 'houston')), 1, 'Houston dispatcher reads Houston requests');
select is((select count(*)::int from public.requests where id = (select v from t_ids where k = 'san-antonio')), 0, 'Houston dispatcher cannot read San Antonio requests');
select is((select count(*)::int from public.request_events where request_id = (select v from t_ids where k = 'san-antonio')), 0, 'nor their events');
select is((select count(*)::int from public.provider_wallets), 0, 'dispatchers cannot read wallets');
reset role;

-- AC2 (database side): without the second step (aal1) staff read nothing.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal1', 'app_role', 'staff', 'staff_role', 'super_admin'));
select is(pg_temp.visible_requests(), 0, 'super admin with only a password (aal1) sees no requests');
select is((select count(*)::int from public.markets), 0, 'and no markets');
reset role;

select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'super_admin', 'staff_markets', null));
select is(pg_temp.visible_requests(), 2, 'super admin with aal2 and no market limit sees all markets');
select ok((select count(*) from public.provider_wallets) >= 1, 'super admin reads wallets');
reset role;

select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'marketing', 'staff_markets', null));
select is((select count(*)::int from public.consents where request_id in (select v from t_ids)), 0, 'marketing cannot read consents');
select is((select count(*)::int from public.attributions where request_id in (select v from t_ids)), 2, 'marketing reads attributions');
reset role;

-- AC3: provider operators cannot read wallet or billing data; owners can.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal1', 'app_role', 'provider',
  'providers', jsonb_build_array(jsonb_build_object('provider_id', '00000000-0000-4000-8000-0000000000b1', 'role', 'operator'))));
select is((select count(*)::int from public.providers where id = '00000000-0000-4000-8000-0000000000b1'), 1, 'operator reads their company');
select is((select count(*)::int from public.provider_wallets), 0, 'operator cannot read the wallet');
select is((select count(*)::int from public.provider_billing_events), 0, 'operator cannot read billing');
select is(pg_temp.visible_requests(), 0, 'operator cannot read requests directly');
reset role;

select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal1', 'app_role', 'provider',
  'providers', jsonb_build_array(jsonb_build_object('provider_id', '00000000-0000-4000-8000-0000000000b1', 'role', 'owner'))));
select is((select balance_cents from public.provider_wallets where provider_id = '00000000-0000-4000-8000-0000000000b1'), 10000, 'owner reads the wallet');
select is((select count(*)::int from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000000b1'), 1, 'owner reads billing');
reset role;

select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal1', 'app_role', 'driver'));
select is(pg_temp.visible_requests(), 0, 'drivers cannot read requests directly (they use the status token)');
reset role;

-- Access token hook adds the role claims.
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000c1', 'rls-staff@example.test', 'authenticated', 'authenticated');
insert into public.staff_members (user_id, role, market_ids, display_name)
values ('00000000-0000-4000-8000-0000000000c1', 'dispatcher', array[(select id from public.markets where slug = 'houston')], 'RLS Test Staff');
select is(
  (public.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000000c1', 'claims', jsonb_build_object('aal', 'aal1'))) #>> '{claims,staff_role}'),
  'dispatcher', 'hook adds the staff role'
);
select is(
  (public.custom_access_token_hook(jsonb_build_object('user_id', gen_random_uuid(), 'claims', '{}'::jsonb)) #>> '{claims,app_role}'),
  'driver', 'users without a membership are drivers'
);

select * from finish();
rollback;
