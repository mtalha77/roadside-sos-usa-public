-- RSOS-105: tour progress belongs to its person. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000105a1', 'tour-a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000105b1', 'tour-b@example.test', 'authenticated', 'authenticated');

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', u, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- A saves and updates their own progress.
select pg_temp.as_user('00000000-0000-4000-8000-0000000105a1');
select lives_ok(
  $$insert into public.tour_progress (user_id, tour, status, step) values ('00000000-0000-4000-8000-0000000105a1', 'admin.dispatcher', 'started', 1)$$,
  'a person saves their own tour progress');
update public.tour_progress set status = 'hidden' where tour = 'admin.dispatcher';
select is((select status from public.tour_progress where tour = 'admin.dispatcher'), 'hidden', 'a person updates their own progress');
select throws_ok(
  $$insert into public.tour_progress (user_id, tour, status) values ('00000000-0000-4000-8000-0000000105b1', 'admin.owner', 'done')$$,
  '42501', null, 'nobody saves progress for someone else');
reset role;

-- B cannot see, change or delete A's rows.
select pg_temp.as_user('00000000-0000-4000-8000-0000000105b1');
select is((select count(*)::int from public.tour_progress), 0, 'a person sees no one else''s progress');
update public.tour_progress set status = 'done' where user_id = '00000000-0000-4000-8000-0000000105a1';
delete from public.tour_progress where user_id = '00000000-0000-4000-8000-0000000105a1';
reset role;
select is((select status from public.tour_progress where user_id = '00000000-0000-4000-8000-0000000105a1'), 'hidden',
  'nobody changes or deletes someone else''s progress');

-- Anonymous visitors have no access; bad values are refused.
set local role anon;
select throws_ok($$select * from public.tour_progress$$, '42501', null, 'anonymous visitors cannot read tour progress');
reset role;
select throws_ok(
  $$insert into public.tour_progress (user_id, tour, status) values ('00000000-0000-4000-8000-0000000105a1', 'x', 'done')$$,
  '23514', null, 'tour names are checked');
select throws_ok(
  $$insert into public.tour_progress (user_id, tour, status) values ('00000000-0000-4000-8000-0000000105a1', 'web.demo', 'maybe')$$,
  '23514', null, 'statuses are checked');

select * from finish();
rollback;
