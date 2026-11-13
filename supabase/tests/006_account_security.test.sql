-- RSOS-093: second step by email code, lockout, remote sign-out, recovery codes, audit. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(18);

insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000d1', 'sec-test@example.test', 'authenticated', 'authenticated');
insert into auth.sessions (id, user_id) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1');

create function pg_temp.as_session(p_session text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-0000000000d1', 'role', 'authenticated',
    'aal', 'aal1', 'app_role', 'provider', 'session_id', p_session)::text, true), set_config('role', 'authenticated', true);
$$;
create temporary table t_code (code text);
grant all on t_code to authenticated;

-- AC1: email-code providers cannot pass without the code; 5 wrong codes lock for 15 minutes.
select pg_temp.as_session('00000000-0000-4000-8000-0000000000e1');
select is((select second_step_passed from public.session_status()), false, 'a new session has not passed the second step');
insert into t_code select public.issue_email_code();
select matches((select code from t_code), '^[0-9]{6}$', 'issues a 6-digit code');
select is(public.verify_email_code('000000x'), 'invalid', 'wrong code 1');
select is(public.verify_email_code('111111x'), 'invalid', 'wrong code 2');
select is(public.verify_email_code('222222x'), 'invalid', 'wrong code 3');
select is(public.verify_email_code('333333x'), 'invalid', 'wrong code 4');
select is(public.verify_email_code('444444x'), 'locked', 'the fifth wrong code locks the account');
select is(public.verify_email_code((select code from t_code)), 'locked', 'even the right code is refused while locked');
select throws_ok($$ select public.issue_email_code() $$, 'P0001', null, 'no new code while locked');
reset role;
select ok((select locked_until between now() + interval '14 minutes' and now() + interval '16 minutes' from public.email_second_step_codes where user_id = '00000000-0000-4000-8000-0000000000d1'), 'the lock lasts 15 minutes');
update public.email_second_step_codes set locked_until = now() - interval '1 second' where user_id = '00000000-0000-4000-8000-0000000000d1';

select pg_temp.as_session('00000000-0000-4000-8000-0000000000e1');
delete from t_code; insert into t_code select public.issue_email_code();
select is(public.verify_email_code((select code from t_code)), 'ok', 'after the lock the right code passes');
select is((select second_step_passed from public.session_status()), true, 'the session is marked as passed');
reset role;
update public.email_second_step_codes set expires_at = now() - interval '1 second' where user_id = '00000000-0000-4000-8000-0000000000d1';

-- AC2: signing out a device ends that session (the proxy checks session_status on every request).
select pg_temp.as_session('00000000-0000-4000-8000-0000000000e2');
select is(public.revoke_my_session('00000000-0000-4000-8000-0000000000e1'), true, 'sign out the other device');
reset role;
select pg_temp.as_session('00000000-0000-4000-8000-0000000000e1');
select is((select active from public.session_status()), false, 'the signed-out session is no longer active');
reset role;

-- Recovery codes are single use.
select pg_temp.as_session('00000000-0000-4000-8000-0000000000e2');
delete from t_code; insert into t_code select * from public.generate_recovery_codes() limit 1;
select is(public.use_recovery_code((select code from t_code)), true, 'a recovery code works once');
select is(public.use_recovery_code((select code from t_code)), false, 'and never again');
reset role;

-- AC3: every security change is in the audit log.
select ok((select count(*) from public.audit_log where actor_id = '00000000-0000-4000-8000-0000000000d1'
  and action in ('auth.second_step_locked', 'auth.second_step_passed', 'auth.session_revoked', 'auth.recovery_codes_generated', 'auth.recovery_code_used')) = 5,
  'lockout, second step, sign-out and recovery codes are audited');
select pg_temp.as_session('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.log_security_event('anything goes') $$, '22023', null, 'only known security actions can be logged');
reset role;

select * from finish();
rollback;
