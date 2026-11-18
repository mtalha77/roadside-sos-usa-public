-- RSOS-102: the permission matrix in the database, one role at a time. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(10);

create function pg_temp.as_role(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true), set_config('role', 'authenticated', true);
$$;

-- A provider and a fee row to look at.
insert into public.providers (id, name, status) values ('00000000-0000-4000-8000-0000000102a1', 'Role Test Towing', 'active');
insert into public.provider_billing_events (provider_id, kind, amount_cents)
values ('00000000-0000-4000-8000-0000000102a1', 'manual_test', 500);

-- Dispatcher: reads providers, cannot edit them, sees no fee rows.
select pg_temp.as_role('dispatcher');
select is((select count(*)::int from public.providers where id = '00000000-0000-4000-8000-0000000102a1'), 1, 'a dispatcher reads providers');
update public.providers set name = 'Changed by dispatcher' where id = '00000000-0000-4000-8000-0000000102a1';
select is((select count(*)::int from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000102a1'), 0, 'a dispatcher sees no fee rows');
reset role;
select is((select name from public.providers where id = '00000000-0000-4000-8000-0000000102a1'), 'Role Test Towing', 'a dispatcher cannot edit a provider');

-- Provider success edits providers.
select pg_temp.as_role('support');
update public.providers set name = 'Edited by provider success' where id = '00000000-0000-4000-8000-0000000102a1';
select is((select count(*)::int from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000102a1'), 0, 'provider success sees no fee rows');
reset role;
select is((select name from public.providers where id = '00000000-0000-4000-8000-0000000102a1'), 'Edited by provider success', 'provider success edits a provider');

-- Finance and viewers read fee rows; marketing does not.
select pg_temp.as_role('finance');
select is((select count(*)::int from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000102a1'), 1, 'finance reads fee rows');
reset role;
select pg_temp.as_role('read_only');
select is((select count(*)::int from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000102a1'), 1, 'a viewer reads fee rows');
update public.providers set name = 'Changed by viewer' where id = '00000000-0000-4000-8000-0000000102a1';
reset role;
select is((select name from public.providers where id = '00000000-0000-4000-8000-0000000102a1'), 'Edited by provider success', 'a viewer cannot edit a provider');
select pg_temp.as_role('marketing');
select is((select count(*)::int from public.provider_billing_events where provider_id = '00000000-0000-4000-8000-0000000102a1'), 0, 'marketing sees no fee rows');
reset role;

-- Nobody but owners and operations managers changes the team (no table policy allows it).
select pg_temp.as_role('dispatcher');
select throws_ok($$ insert into public.staff_members (user_id, role, display_name) values (gen_random_uuid(), 'super_admin', 'Sneaky') $$,
  '42501', null, 'a dispatcher cannot add staff');
reset role;

select * from finish();
rollback;
