-- RSOS-089-prep: the launch checklist blocks going live; super admins override with a reason.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(7);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_role(r text) returns void language sql as $$
  select pg_temp.as_user(jsonb_build_object('sub', '00000000-0000-4000-8000-0000000007a1', 'role', 'authenticated', 'aal', 'aal2',
    'app_role', 'staff', 'staff_role', r));
$$;
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000007a1', 'kit@example.test', 'authenticated', 'authenticated');

set local role anon;
select throws_ok($$ select * from public.market_launch_checklist((select id from public.markets limit 1)) $$, '42501', null,
  'visitors cannot read the checklist');
reset role;

select set_config('test.market', (select id::text from public.markets where slug = 'houston'), true);
-- rsos-dev keeps audit rows from e2e runs: the test checks the increase.
select set_config('test.overrides_before', (select count(*)::text from public.audit_log
  where action = 'market.live_override' and entity_id = current_setting('test.market')), true);
select pg_temp.as_role('ops_manager');
select is((select count(*)::int from public.market_launch_checklist(current_setting('test.market')::uuid)), 6, 'six checklist items');
select ok((select not ok from public.market_launch_checklist(current_setting('test.market')::uuid) where item = 'providers'),
  'a market without enough real providers is not ready');
select throws_ok($$ select public.set_market_status(current_setting('test.market')::uuid, 'active') $$, '22023', null,
  'going live is blocked while items are missing');
select throws_ok($$ select public.set_market_status(current_setting('test.market')::uuid, 'active', 'testing override') $$, '22023', null,
  'an ops manager cannot override');
reset role;

select pg_temp.as_role('super_admin');
select lives_ok($$ select public.set_market_status(current_setting('test.market')::uuid, 'active', 'Test campaign starts today') $$,
  'a super admin overrides with a reason');
reset role;
select is((select count(*)::int from public.audit_log where action = 'market.live_override' and entity_id = current_setting('test.market')),
  current_setting('test.overrides_before')::int + 1, 'the override is in the audit log');

select * from finish();
rollback;
