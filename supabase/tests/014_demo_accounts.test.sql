-- Batch 3: demo account secrets are unreadable by visitors and signed-in users. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(2);
set local role anon;
select throws_ok($$ select * from public.demo_accounts $$, '42501', null, 'visitors cannot read demo accounts');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.demo_accounts $$, '42501', null, 'signed-in users cannot read demo accounts');
reset role;
select * from finish();
rollback;
