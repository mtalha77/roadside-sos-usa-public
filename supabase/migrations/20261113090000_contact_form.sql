-- RSOS-027: the website contact form stores messages through this function (visitors still have
-- no table access). The app verifies Turnstile and rate limits before calling it.
create function public.submit_contact_message(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text := nullif(trim(p ->> 'email'), '');
  v_phone text := nullif(trim(p ->> 'phone'), '');
  v_market uuid;
begin
  if coalesce(length(trim(p ->> 'name')), 0) not between 1 and 120 then raise exception 'invalid name' using errcode = '22023'; end if;
  if coalesce(length(trim(p ->> 'message')), 0) not between 1 and 5000 then raise exception 'invalid message' using errcode = '22023'; end if;
  if v_email is null and v_phone is null then raise exception 'email or phone required' using errcode = '22023'; end if;
  select id into v_market from public.markets where slug = (p ->> 'market_slug')::extensions.citext and status in ('test', 'active');
  insert into public.contact_messages (market_id, name, email, phone, topic, message)
  values (v_market, trim(p ->> 'name'), v_email, v_phone, left(nullif(p ->> 'topic', ''), 40), trim(p ->> 'message'))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_contact_message(jsonb) from public;
grant execute on function public.submit_contact_message(jsonb) to anon, authenticated;
