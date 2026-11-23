-- RSOS-035: SMS templates, system settings and the delivery report. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.sms_templates'::regclass, 'public.system_settings'::regclass)),
  'RLS on templates and settings');
select is((select value ->> 'status' from public.system_settings where key = 'a2p_10dlc'), 'pending',
  'texting starts as registration pending');
select ok((select bool_and(body_en like '%{%' or key = 'still_looking') from public.sms_templates), 'templates carry placeholders');

set local role anon;
select throws_ok($$ select * from public.sms_templates $$, '42501', null, 'visitors cannot read templates');
select throws_ok($$ select * from public.sms_delivery_report() $$, '42501', null, 'visitors cannot read delivery reports');
reset role;

-- A dispatcher reads but cannot change templates or the registration override.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'dispatcher'));
select ok((select count(*) from public.sms_templates) >= 5, 'staff read templates');
update public.sms_templates set body_en = 'changed' where key = 'help';
update public.system_settings set value = '{"status":"approved","override":true}' where key = 'a2p_10dlc';
reset role;
select isnt((select body_en from public.sms_templates where key = 'help'), 'changed', 'a dispatcher cannot edit templates');
select is((select value ->> 'override' from public.system_settings where key = 'a2p_10dlc'), 'false', 'or turn on the override');

-- A super admin can.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'super_admin'));
update public.system_settings set value = '{"status":"pending","override":true}' where key = 'a2p_10dlc';
reset role;
select is((select value ->> 'override' from public.system_settings where key = 'a2p_10dlc'), 'true', 'a super admin turns on the override');

select * from finish();
rollback;
