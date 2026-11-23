-- Owner decision (release 1): the Postgres rate limiter is real; its counters are swept nightly.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(5);

select is(
  (select count(*)::integer from cron.job where jobname = 'rate-limit-sweep' and command = 'select public.rate_limit_sweep()'),
  1, 'the nightly sweep is scheduled once');

-- Per-market and per-email keys count like per-IP keys.
set local role anon;
select is(public.rate_limit_hit('request:market:test-sweep', 3600), 1, 'first market hit is 1');
select is(public.rate_limit_hit('request:market:test-sweep', 3600), 2, 'second market hit is 2');
select throws_ok($$ select public.rate_limit_sweep() $$, '42501', null, 'visitors cannot sweep');
reset role;

update public.rate_limit_counters set window_start = now() - interval '2 days'
  where key = 'request:market:test-sweep';
select ok(public.rate_limit_sweep() >= 1, 'the sweep deletes windows older than a day');

select * from finish();
rollback;
