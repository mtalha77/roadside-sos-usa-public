-- RSOS-021: the Get Help flow keeps a draft per visitor between steps (so a reload or a lost
-- connection keeps their place), finds a recent request from the same phone (no duplicates) and
-- submits with the phone verification result. Visitors reach drafts only through these functions,
-- by an unguessable token kept in an HttpOnly cookie.

create table public.request_drafts (
  token text primary key default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day'
);
create index request_drafts_expires_idx on public.request_drafts (expires_at);
alter table public.request_drafts enable row level security;
revoke all on public.request_drafts from anon, authenticated;

-- Merges a patch into the visitor's draft; creates a new draft when the token is missing or expired.
create function public.save_request_draft(p_token text, p_patch jsonb) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_token text;
begin
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid draft' using errcode = '22023'; end if;
  update public.request_drafts
     set data = data || p_patch, updated_at = now(), expires_at = now() + interval '1 day'
   where token = p_token and expires_at > now()
  returning token into v_token;
  if v_token is null then
    insert into public.request_drafts (data) values (p_patch) returning token into v_token;
  end if;
  return v_token;
end;
$$;

create function public.get_request_draft(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select data from public.request_drafts where token = p_token and expires_at > now();
$$;

-- The open request from this phone in the last 30 minutes, if any (the flow opens it instead).
create function public.find_recent_request(p_phone text) returns text
language sql stable security definer set search_path = '' as $$
  select r.status_token from public.requests r
  where r.driver_phone = p_phone::public.us_phone
    and r.created_at > now() - interval '30 minutes'
    and r.status not in ('completed', 'cancelled', 'expired')
  order by r.created_at desc limit 1;
$$;

-- Creates the request (create_request: attribution, consents, first event in one transaction),
-- records whether the phone was verified, and deletes the draft.
create function public.submit_web_request(p jsonb, p_draft_token text, p_phone_verified boolean)
returns table (request_id uuid, short_code text, status_token text)
language plpgsql volatile security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.create_request(p);
  update public.requests set driver_phone_verified = p_phone_verified where id = r.request_id;
  delete from public.request_drafts where token = p_draft_token;
  return query select r.request_id, r.short_code, r.status_token;
end;
$$;

revoke execute on function public.save_request_draft(text, jsonb), public.get_request_draft(text), public.find_recent_request(text),
  public.submit_web_request(jsonb, text, boolean) from public;
grant execute on function public.save_request_draft(text, jsonb), public.get_request_draft(text), public.find_recent_request(text),
  public.submit_web_request(jsonb, text, boolean) to anon, authenticated;
