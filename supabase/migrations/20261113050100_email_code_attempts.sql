-- RSOS-093: a new emailed code no longer resets the wrong-attempt counter, so five wrong codes lock
-- the account for 15 minutes even if the user asks for new codes in between. The counter resets
-- after a correct code (row deleted) or once a lock has expired.
create or replace function public.issue_email_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  r public.email_second_step_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into r from public.email_second_step_codes where user_id = auth.uid() for update;
  if r.locked_until is not null and r.locked_until > now() then
    raise exception 'locked until %', r.locked_until using errcode = 'P0001', hint = 'locked';
  end if;
  insert into public.email_second_step_codes (user_id, code_hash, expires_at, attempts, locked_until)
  values (auth.uid(), public.sha256_hex(v_code), now() + interval '10 minutes', 0, null)
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = case when public.email_second_step_codes.locked_until is not null then 0 else public.email_second_step_codes.attempts end,
        locked_until = null,
        created_at = now();
  return v_code;
end;
$$;
