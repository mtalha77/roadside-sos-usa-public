-- RSOS-024: city page content. Public through the function only; staff edit by role. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(10);

create function pg_temp.as_user(claims jsonb) returns void language sql as $$
  select set_config('request.jwt.claims', claims::text, true), set_config('role', 'authenticated', true);
$$;

-- AC1: the three test markets have unique copy.
select is((select count(distinct intro)::int from public.market_pages p join public.markets m on m.id = p.market_id
           where m.slug in ('san-antonio', 'las-vegas', 'houston')), 3, 'three test markets, three different intros');
select ok((select bool_and(array_length(areas, 1) >= 8 and array_length(highways, 1) >= 5 and jsonb_array_length(faqs) >= 3)
           from public.market_pages), 'every page lists areas, highways and local FAQs');
select ok((select bool_and(seo_title is not null and seo_intro is not null) from public.markets where slug in ('san-antonio', 'las-vegas', 'houston')),
  'titles and descriptions are set');

set local role anon;
select ok((select intro from public.get_market_page('houston', 'en')) like '%Houston%', 'visitors read a page through the function');
select ok((select intro from public.get_market_page('las-vegas', 'es')) is not null, 'Spanish falls back to English until translated');
select is_empty($$ select * from public.get_market_page('phoenix', 'en') $$, 'paused markets have no public page');
select throws_ok($$ select * from public.market_pages $$, '42501', null, 'visitors cannot read the table directly');
reset role;

-- Staff: marketing edits pages; a dispatcher can read but not edit.
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'marketing'));
select lives_ok($$ update public.market_pages set local_tips = array_append(local_tips, 'Test tip') where market_id = (select id from public.markets where slug = 'houston') $$,
  'marketing edits a page');
reset role;
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'dispatcher'));
update public.market_pages set intro = 'x' where market_id = (select id from public.markets where slug = 'houston');
reset role;
select ok((select intro from public.market_pages where market_id = (select id from public.markets where slug = 'houston')) <> 'x', 'a dispatcher cannot change copy');
select pg_temp.as_user(jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal2', 'app_role', 'staff', 'staff_role', 'dispatcher'));
select is((select count(*)::int from public.market_pages), 3, 'but can read it');
reset role;

select * from finish();
rollback;
