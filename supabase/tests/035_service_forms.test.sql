-- RSOS-116: structured answers attach once, within 10 minutes, with photos only from the visitor's
-- own draft folder; question overrides are public to read and changed only by managers. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

create function pg_temp.as_staff(r text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000116a1',
    'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', r)::text, true),
    set_config('role', 'authenticated', true);
$$;
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000116a1', 'forms@example.test', 'authenticated', 'authenticated');

insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone)
values ('00000000-0000-4000-8000-0000000116c1', 'R-FRM1', (select id from public.markets where slug = 'houston'), 0, 'submitted', 'web', 'Form Test', '+12105550144');
select set_config('test.token', (select status_token from public.requests where id = '00000000-0000-4000-8000-0000000116c1'), true);
select set_config('test.draft', repeat('d', 32), true);

set local role anon;
select throws_ok($$ select public.set_request_answers(current_setting('test.token'), current_setting('test.draft'), '{"safety":"safe"}', 1,
    array['draft/someone-else-token-0000000000/0.jpg'], null, false) $$, '22023', null,
  'photos only from the visitor''s own draft folder');
select lives_ok($$ select public.set_request_answers(current_setting('test.token'), current_setting('test.draft'),
    '{"safety":"safe","childInside":"yes"}', 1, array['draft/' || current_setting('test.draft') || '/0.jpg'], null, true) $$,
  'a visitor attaches the answers with the status token');
reset role;
select is((select service_answers ->> 'childInside' from public.requests where id = '00000000-0000-4000-8000-0000000116c1'), 'yes',
  'answers are stored as structured JSON');
select is((select answers_version from public.requests where id = '00000000-0000-4000-8000-0000000116c1'), 1, 'with their version');
select ok((select urgent from public.requests where id = '00000000-0000-4000-8000-0000000116c1'), 'a child inside marks it urgent');
set local role anon;
select public.set_request_answers(current_setting('test.token'), current_setting('test.draft'), '{"safety":"lane"}', 1, null, null, false);
reset role;
select is((select service_answers ->> 'safety' from public.requests where id = '00000000-0000-4000-8000-0000000116c1'), 'safe',
  'answers attach only once');

-- Overrides.
select pg_temp.as_staff('dispatcher');
select throws_ok($$ select public.set_question_override((select id from public.markets where slug = 'houston'), 'flat-tire', 'whichTire', true, null, null) $$,
  '42501', null, 'dispatchers cannot change questions');
reset role;
select pg_temp.as_staff('ops_manager');
select throws_ok($$ select public.set_question_override((select id from public.markets where slug = 'houston'), 'tow', 'safety', true, null, null) $$,
  '22023', null, 'the safety question is always asked');
select lives_ok($$ select public.set_question_override((select id from public.markets where slug = 'houston'), 'flat-tire', 'whichTire', true, null, null) $$,
  'an operations manager hides a question in a market');
reset role;

select * from finish();
rollback;
