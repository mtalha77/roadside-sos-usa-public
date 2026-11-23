begin;
select plan(2);

select is(
  (select prosecdef from pg_proc where proname = 'admin_market_shapes'), false,
  'market shapes run as the caller, so the staff policy applies'
);
set local role anon;
select throws_ok('select * from public.admin_market_shapes()', '42501', null, 'anonymous visitors cannot read market shapes');

select * from finish();
rollback;
