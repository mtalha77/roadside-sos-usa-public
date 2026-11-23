-- RSOS-027: contact messages are stored through the function; visitors cannot read them. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(5);

create temporary table t_id (id uuid);
grant insert, select on t_id to anon;
set local role anon;
insert into t_id select public.submit_contact_message('{"name":"Dev Test","email":"dev@example.test","topic":"general","message":"Hello","market_slug":"houston"}');
select throws_ok($$ select public.submit_contact_message('{"name":"Dev Test","message":"No way to reply"}') $$, '22023', null, 'needs an email or a phone');
select throws_ok($$ select * from public.contact_messages $$, '42501', null, 'visitors cannot read messages');
reset role;
select is((select name from public.contact_messages where id = (select id from t_id)), 'Dev Test', 'the message is stored');
select is((select m.slug::text from public.contact_messages c join public.markets m on m.id = c.market_id where c.id = (select id from t_id)), 'houston', 'tagged with the market');
select is((select status::text from public.contact_messages where id = (select id from t_id)), 'new', 'new messages wait for the team');

select * from finish();
rollback;
