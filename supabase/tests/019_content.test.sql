begin;
select plan(3);

set local role anon;
select throws_ok(
  $$select public.admin_update_market_intro('houston', repeat('x', 50))$$, '42501', null,
  'anonymous visitors cannot edit city intros'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "app_role": "staff", "aal": "aal2", "staff_role": "dispatcher"}';
select throws_ok(
  $$select public.admin_update_market_intro('houston', repeat('x', 50))$$, '42501', null,
  'dispatchers cannot edit city intros'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "app_role": "staff", "aal": "aal2", "staff_role": "ops_manager"}';
select throws_ok(
  $$select public.admin_update_market_intro('houston', 'too short')$$, '22023', null,
  'intros must be long enough to be useful'
);

select * from finish();
rollback;
