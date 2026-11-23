begin;
select plan(3);

select has_function('public', 'admin_live_requests', array['timestamp with time zone'], 'board function exists');
select is(
  (select prosecdef from pg_proc where proname = 'admin_live_requests'), false,
  'board function runs as the caller, so staff market policies apply'
);
set local role anon;
select throws_ok(
  'select * from public.admin_live_requests()', '42501', null,
  'anonymous visitors cannot read the board'
);

select * from finish();
rollback;
