-- RSOS-113: who reads and edits the economics model, and the change history. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

create function pg_temp.as_role(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true), set_config('role', 'authenticated', true);
$$;

-- A market of its own, so the counts do not depend on other rows.
insert into public.markets (id, slug, name, state_code, time_zone, center, boundary, status)
values ('00000000-0000-4000-8000-0000000113a1', 'econ-test-market', 'Econ Test', 'TX', 'America/Chicago',
        extensions.st_setsrid(extensions.st_makepoint(-97.0, 30.0), 4326)::extensions.geography,
        extensions.st_multi(extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(-97.0, 30.0), 4326), 0.05))::extensions.geography,
        'draft');
insert into public.economics_models (market_id, scenario, inputs)
values ('00000000-0000-4000-8000-0000000113a1', 'base', '{"monthlyBudget": 4000, "costPerClick": 4.25}');
select is((select count(*)::int from public.economics_model_history where market_id = '00000000-0000-4000-8000-0000000113a1'),
  1, 'saving the model writes a history row');

-- Owners and operations managers edit; every change adds history.
select pg_temp.as_role('ops_manager');
update public.economics_models set inputs = '{"monthlyBudget": 4000, "costPerClick": 3.10}'
 where market_id = '00000000-0000-4000-8000-0000000113a1';
select is((select count(*)::int from public.economics_model_history where market_id = '00000000-0000-4000-8000-0000000113a1'),
  2, 'an operations manager changes the model and it is kept in history');
reset role;
select is((select (inputs->>'costPerClick')::numeric from public.economics_models where market_id = '00000000-0000-4000-8000-0000000113a1'),
  3.10, 'the change is saved');

-- Finance reads but cannot change it, nor see the history.
select pg_temp.as_role('finance');
select is((select count(*)::int from public.economics_models where market_id = '00000000-0000-4000-8000-0000000113a1'), 1,
  'finance reads the model');
update public.economics_models set inputs = '{"costPerClick": 1}' where market_id = '00000000-0000-4000-8000-0000000113a1';
select is((select count(*)::int from public.economics_model_history where market_id = '00000000-0000-4000-8000-0000000113a1'), 0,
  'finance sees no history');
reset role;
select is((select (inputs->>'costPerClick')::numeric from public.economics_models where market_id = '00000000-0000-4000-8000-0000000113a1'),
  3.10, 'finance cannot change the model');

-- Dispatchers do not see it; visitors have no access; history cannot be rewritten.
select pg_temp.as_role('dispatcher');
select is((select count(*)::int from public.economics_models where market_id = '00000000-0000-4000-8000-0000000113a1'), 0,
  'a dispatcher does not see the model');
reset role;
set local role anon;
select throws_ok($$select * from public.economics_models$$, '42501', null, 'visitors cannot read the model');
reset role;
select throws_ok($$delete from public.economics_model_history where market_id = '00000000-0000-4000-8000-0000000113a1'$$,
  null, null, 'history is append-only');

select * from finish();
rollback;
