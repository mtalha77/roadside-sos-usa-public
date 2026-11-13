-- RSOS-025: service pages and local notes. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

select is((select count(*)::int from public.service_pages), (select count(*)::int from public.services), 'every service has a page');
select is((select count(distinct n.note)::int from public.market_service_notes n join public.markets m on m.id = n.market_id
           where m.slug in ('san-antonio', 'las-vegas', 'houston')), 18, '18 unique local notes (6 services x 3 test markets)');

set local role anon;
select ok((select array_length(covers, 1) from public.get_service_page('tow', 'en')) >= 2, 'visitors read a service page');
select ok((select public.get_market_service_note('houston', 'tow', 'es')) like '%Harris%', 'local note, Spanish falls back to English');
select is((select public.get_market_service_note('phoenix', 'tow', 'en')), null::text, 'no notes for unpublished markets');
select throws_ok($$ select * from public.service_pages $$, '42501', null, 'no direct table access for visitors');
reset role;

select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'support'));
update public.service_pages set summary = 'changed by support, should not apply';
reset role;
select is((select count(*)::int from public.service_pages where summary like 'changed by support%'), 0, 'support cannot edit service copy');
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'marketing'));
select lives_ok($$ update public.market_service_notes set note = note || ' Updated.' where locale = 'en' $$, 'marketing edits local notes');
reset role;

select * from finish();
rollback;
