-- Owner decision (release 1): "Sentry live" is a required go-live item and gates paid ads. Only the
-- service role records it; staff read it; a result older than a day does not count. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(7);

insert into public.platform_checks (key, ok, detail, checked_at)
values ('sentry', true, null, now())
on conflict (key) do update set ok = true, detail = null, checked_at = now();
select ok(public.platform_check_ok('sentry'), 'a fresh passing check counts');
update public.platform_checks set checked_at = now() - interval '25 hours' where key = 'sentry';
select ok(not public.platform_check_ok('sentry'), 'a check older than a day does not count');
select ok(not public.platform_check_ok('nothing_here'), 'an unknown check is not ok (not NULL)');

-- Staff read; nobody writes through the API.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000123a1',
  'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'marketing')::text, true);
set local role authenticated;
select is((select count(*)::int from public.platform_checks where key = 'sentry'), 1, 'staff read the check');
select throws_ok($$ insert into public.platform_checks (key, ok) values ('sentry_fake', true) $$, '42501', null,
  'staff cannot record a check');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000123a2',
  'role', 'authenticated', 'aal', 'aal1', 'app_role', 'provider')::text, true);
set local role authenticated;
select is((select count(*)::int from public.platform_checks), 0, 'providers read nothing');
reset role;
set local role anon;
select throws_ok($$ select public.platform_check_ok('sentry') $$, '42501', null, 'visitors cannot call it');
reset role;

select * from finish();
rollback;
