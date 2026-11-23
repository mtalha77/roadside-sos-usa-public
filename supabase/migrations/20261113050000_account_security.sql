-- RSOS-093: account and security settings.
-- Provider second step by emailed 6-digit code (10-minute validity, 5 attempts then a 15-minute
-- lock), optional SMS or authenticator; trusted devices for 30 days; recovery codes; signed-in
-- devices with remote sign-out; every security change in the audit log.

create type public.second_step_method as enum ('email', 'sms', 'totp');

create table public.user_security_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  second_step_method public.second_step_method not null default 'email',
  updated_at timestamptz not null default now()
);

-- One active code per user. Only the SHA-256 hash is stored.
create table public.email_second_step_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- Sessions that completed the second step (keyed by the JWT session_id).
create table public.verified_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null,
  verified_at timestamptz not null default now()
);

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index trusted_devices_user_idx on public.trusted_devices (user_id);

create table public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index recovery_codes_user_idx on public.recovery_codes (user_id);

create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete set null,
  kind text not null check (kind in ('close_account')),
  reason text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['user_security_settings', 'email_second_step_codes', 'verified_sessions', 'trusted_devices', 'recovery_codes', 'account_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- Users read their own non-secret security data; everything else goes through functions below.
create policy "own security settings" on public.user_security_settings for select to authenticated using (user_id = auth.uid());
create policy "own trusted devices" on public.trusted_devices for select to authenticated using (user_id = auth.uid());
create policy "own account requests" on public.account_requests for select to authenticated using (user_id = auth.uid());
create policy "staff read account requests" on public.account_requests for select to authenticated using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'));

create function public.sha256_hex(p text) returns text
language sql immutable set search_path = '' as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

-- Audit trail for security events (sign-in, password, email, phone, second step, devices).
-- Always about the signed-in user (no user parameter: nobody can write events for someone else).
create function public.log_security_event(p_action text, p_data jsonb default '{}', p_ip text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_action !~ '^(auth|account)\.[a-z_]+$' then raise exception 'invalid action' using errcode = '22023'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data, ip)
  values (auth.uid(), coalesce(auth.jwt() ->> 'app_role', 'driver'), p_action, 'user', auth.uid()::text, coalesce(p_data, '{}'), nullif(p_ip, '')::inet);
end;
$$;

-- Issues a new emailed code for the signed-in user; returns it once so the server can email it.
-- Refuses while the user is locked out.
create function public.issue_email_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_lock timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select locked_until into v_lock from public.email_second_step_codes where user_id = auth.uid();
  if v_lock is not null and v_lock > now() then
    raise exception 'locked until %', v_lock using errcode = 'P0001', hint = 'locked';
  end if;
  insert into public.email_second_step_codes (user_id, code_hash, expires_at, attempts, locked_until)
  values (auth.uid(), public.sha256_hex(v_code), now() + interval '10 minutes', 0, null)
  on conflict (user_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, locked_until = null, created_at = now();
  return v_code;
end;
$$;

-- Checks a code. Result: 'ok', 'invalid', 'expired' or 'locked'. Five wrong codes lock for 15 minutes.
-- On success the current session (JWT session_id) is marked verified.
create function public.verify_email_code(p_code text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.email_second_step_codes%rowtype;
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into r from public.email_second_step_codes where user_id = auth.uid() for update;
  if r.user_id is null then return 'expired'; end if;
  if r.locked_until is not null and r.locked_until > now() then return 'locked'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.code_hash <> public.sha256_hex(coalesce(p_code, '')) then
    update public.email_second_step_codes
       set attempts = attempts + 1,
           locked_until = case when attempts + 1 >= 5 then now() + interval '15 minutes' end
     where user_id = auth.uid();
    if r.attempts + 1 >= 5 then
      perform public.log_security_event('auth.second_step_locked', jsonb_build_object('method', 'email'));
      return 'locked';
    end if;
    return 'invalid';
  end if;
  delete from public.email_second_step_codes where user_id = auth.uid();
  if v_session is not null then
    insert into public.verified_sessions (session_id, user_id, method) values (v_session, auth.uid(), 'email')
    on conflict (session_id) do update set verified_at = now(), method = 'email';
  end if;
  perform public.log_security_event('auth.second_step_passed', jsonb_build_object('method', 'email'));
  return 'ok';
end;
$$;

-- Marks the current session verified by another method (SMS, authenticator, trusted device, recovery code).
create function public.mark_session_verified(p_method text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null or v_session is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_method not in ('sms', 'totp', 'trusted_device', 'recovery_code') then raise exception 'unknown method' using errcode = '22023'; end if;
  if p_method = 'totp' and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'authenticator not verified' using errcode = '42501'; end if;
  insert into public.verified_sessions (session_id, user_id, method) values (v_session, auth.uid(), p_method)
  on conflict (session_id) do update set verified_at = now(), method = excluded.method;
end;
$$;

-- True while the current session exists (not signed out remotely) and passed the second step.
create function public.session_status() returns table (active boolean, second_step_passed boolean)
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.sessions s where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.user_id = auth.uid()),
         exists (select 1 from public.verified_sessions v where v.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid and v.user_id = auth.uid());
$$;

-- Trusted devices: the browser keeps a random token in an HttpOnly cookie; only its hash is stored.
create function public.trust_this_device(p_token text, p_user_agent text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or length(p_token) < 32 then raise exception 'invalid' using errcode = '22023'; end if;
  insert into public.trusted_devices (user_id, token_hash, user_agent, expires_at)
  values (auth.uid(), public.sha256_hex(p_token), left(p_user_agent, 300), now() + interval '30 days');
  perform public.log_security_event('auth.device_trusted', jsonb_build_object('user_agent', left(p_user_agent, 120)));
end;
$$;

create function public.use_trusted_device(p_token text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_token is null then return false; end if;
  if exists (select 1 from public.trusted_devices d where d.user_id = auth.uid() and d.token_hash = public.sha256_hex(p_token) and d.expires_at > now()) then
    perform public.mark_session_verified('trusted_device');
    return true;
  end if;
  return false;
end;
$$;

create function public.forget_trusted_device(p_id uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.trusted_devices where id = p_id and user_id = auth.uid();
  select public.log_security_event('auth.device_forgotten', jsonb_build_object('device', p_id));
$$;

-- Recovery codes: 10 new single-use codes, returned once in plain text.
create function public.generate_recovery_codes() returns setof text
language plpgsql volatile security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.recovery_codes where user_id = auth.uid();
  for i in 1..10 loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 5) || '-' || substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 5));
    insert into public.recovery_codes (user_id, code_hash) values (auth.uid(), public.sha256_hex(v_code));
    return next v_code;
  end loop;
  perform public.log_security_event('auth.recovery_codes_generated');
end;
$$;

create function public.use_recovery_code(p_code text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into v_id from public.recovery_codes
   where user_id = auth.uid() and used_at is null and code_hash = public.sha256_hex(upper(trim(p_code))) limit 1;
  if v_id is null then return false; end if;
  update public.recovery_codes set used_at = now() where id = v_id;
  perform public.mark_session_verified('recovery_code');
  perform public.log_security_event('auth.recovery_code_used');
  return true;
end;
$$;

create function public.set_second_step_method(p_method public.second_step_method) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.user_security_settings (user_id, second_step_method) values (auth.uid(), p_method)
  on conflict (user_id) do update set second_step_method = excluded.second_step_method, updated_at = now();
  select public.log_security_event('auth.second_step_method_changed', jsonb_build_object('method', p_method));
$$;

-- Signed-in devices (own sessions) and remote sign-out.
create function public.my_sessions()
returns table (id uuid, created_at timestamptz, refreshed_at timestamptz, user_agent text, ip text, is_current boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at, coalesce(s.refreshed_at, s.updated_at), s.user_agent, host(s.ip), s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  from auth.sessions s where s.user_id = auth.uid() order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc;
$$;

create function public.revoke_my_session(p_session_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
  if not found then return false; end if;
  delete from public.verified_sessions where session_id = p_session_id;
  perform public.log_security_event('auth.session_revoked', jsonb_build_object('session', p_session_id));
  return true;
end;
$$;

-- Sign-in history: the user's own security events.
create function public.my_security_events(p_limit integer default 50)
returns table (action text, data jsonb, ip text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.action, a.data, host(a.ip), a.created_at from public.audit_log a
  where a.actor_id = auth.uid() and a.entity_type = 'user' and a.action like 'auth.%'
  order by a.created_at desc limit least(greatest(p_limit, 1), 200);
$$;

create function public.request_account_closure(p_reason text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_provider uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select provider_id into v_provider from public.provider_members where user_id = auth.uid() and role = 'owner' limit 1;
  insert into public.account_requests (user_id, provider_id, kind, reason) values (auth.uid(), v_provider, 'close_account', left(p_reason, 2000))
  returning id into v_id;
  perform public.log_security_event('account.closure_requested', jsonb_build_object('request', v_id));
  return v_id;
end;
$$;

-- Providers see their company's status (paused or suspended screens).
create function public.my_provider_status() returns table (provider_id uuid, name text, status public.provider_status, status_reason text, role public.provider_role)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.status, p.status_reason, m.role from public.provider_members m join public.providers p on p.id = m.provider_id
  where m.user_id = auth.uid() order by p.created_at limit 1;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.log_security_event(text, jsonb, text)', 'public.issue_email_code()', 'public.verify_email_code(text)',
    'public.mark_session_verified(text)', 'public.session_status()', 'public.trust_this_device(text, text)', 'public.use_trusted_device(text)',
    'public.forget_trusted_device(uuid)', 'public.generate_recovery_codes()', 'public.use_recovery_code(text)',
    'public.set_second_step_method(public.second_step_method)', 'public.my_sessions()', 'public.revoke_my_session(uuid)',
    'public.my_security_events(integer)', 'public.request_account_closure(text)', 'public.my_provider_status()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function public.sha256_hex(text) from public, anon, authenticated;
