-- RSOS-032: redirects are data; visitors read active ones only through the function. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(5);

insert into public.redirects (source_path, destination) values ('/old-houston', '/roadside-assistance/tx/houston');
insert into public.redirects (source_path, destination, is_active) values ('/retired', '/', false);
select throws_ok($$ insert into public.redirects (source_path, destination) values ('/', '/x') $$, '23514', null, 'the home page cannot be redirected');
select throws_ok($$ insert into public.redirects (source_path, destination) values ('/a', 'http://insecure.example') $$, '23514', null, 'only paths or https destinations');
set local role anon;
select is((select destination from public.list_redirects() where source_path = '/old-houston'), '/roadside-assistance/tx/houston', 'visitors get active redirects');
select is_empty($$ select 1 from public.list_redirects() where source_path = '/retired' $$, 'inactive redirects are ignored');
select throws_ok($$ select * from public.redirects $$, '42501', null, 'no direct table access');
reset role;

select * from finish();
rollback;
