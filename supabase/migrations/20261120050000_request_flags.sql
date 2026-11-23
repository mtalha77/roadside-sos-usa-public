-- Owner decision 3 (2026-11-19): flagging from both sides.
-- Customers report a problem from the tracking page (also after completion); providers flag a
-- request from the offer and job screens. One tap plus a reason, an optional note. Flags reach the
-- admin Inbox with a priority (safety is urgent), show on the request and on both profiles, and
-- are counted per provider and per customer for the fraud signals and reliability scores
-- (RSOS-117, not yet specified: request_flag_counts is the input it will read).

create table public.request_flags (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  -- The provider involved: the assigned provider for a customer flag, the flagging provider for a
  -- provider flag (null when a customer reports before any provider was assigned).
  provider_id uuid references public.providers (id) on delete set null,
  side text not null check (side in ('customer', 'provider')),
  reason text not null check (
    (side = 'customer' and reason in ('no_show', 'price_changed', 'poor_service', 'safety', 'other'))
    or (side = 'provider' and reason in ('fake', 'wrong_location', 'unreachable', 'unsafe', 'other'))
  ),
  note text check (note is null or length(note) <= 500),
  priority text not null check (priority in ('urgent', 'normal')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  raised_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution text check (resolution is null or length(resolution) <= 500),
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index request_flags_request_idx on public.request_flags (request_id, created_at);
create index request_flags_open_idx on public.request_flags (market_id, created_at) where status = 'open';
create index request_flags_provider_idx on public.request_flags (provider_id) where provider_id is not null;

alter table public.request_flags enable row level security;
revoke all on public.request_flags from anon, authenticated;
grant select on public.request_flags to authenticated;
create policy "staff read flags in their markets" on public.request_flags for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "providers read their own flags" on public.request_flags for select to authenticated
  using (side = 'provider' and provider_id is not null and public.jwt_provider_role(provider_id) is not null);

-- Safety comes first: a safety report or an unsafe flag is urgent and makes the request urgent.
create function public.flag_priority(p_reason text) returns text
language sql immutable set search_path = '' as $$
  select case when p_reason in ('safety', 'unsafe') then 'urgent' else 'normal' end;
$$;

create function public.record_request_flag(p_request public.requests, p_side text, p_reason text,
                                           p_note text, p_provider_id uuid, p_actor public.actor_type)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_priority text := public.flag_priority(p_reason);
begin
  -- No long forms and no flooding: three flags per side per request at most.
  if (select count(*) from public.request_flags f where f.request_id = p_request.id and f.side = p_side) >= 3 then
    raise exception 'too many flags' using errcode = '54000';
  end if;
  insert into public.request_flags (request_id, market_id, provider_id, side, reason, note, priority, raised_by, is_test)
  values (p_request.id, p_request.market_id, p_provider_id, p_side, p_reason,
          nullif(left(trim(coalesce(p_note, '')), 500), ''), v_priority, auth.uid(),
          p_request.is_test or public.request_is_test())
  returning id into v_id;
  insert into public.request_events (request_id, event_type, actor_type, actor_id, data)
  values (p_request.id, 'flag', p_actor, auth.uid(),
          jsonb_build_object('flag_id', v_id, 'side', p_side, 'reason', p_reason, 'priority', v_priority));
  if v_priority = 'urgent' then
    update public.requests set urgent = true where id = p_request.id and not urgent;
  end if;
  return v_id;
end;
$$;
revoke all on function public.record_request_flag(public.requests, text, text, text, uuid, public.actor_type) from public, anon, authenticated;

-- Customer: from the tracking link (the status token is the customer's key to the request).
create function public.flag_request_as_customer(p_token text, p_reason text, p_note text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_request public.requests;
begin
  if p_reason not in ('no_show', 'price_changed', 'poor_service', 'safety', 'other') then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  select * into v_request from public.requests r where r.status_token = p_token and r.status <> 'draft';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  return public.record_request_flag(v_request, 'customer', p_reason, p_note, v_request.assigned_provider_id, 'driver');
end;
$$;
revoke all on function public.flag_request_as_customer(text, text, text) from public;
grant execute on function public.flag_request_as_customer(text, text, text) to anon, authenticated;

-- Provider: only for a request the company was offered or assigned.
create function public.flag_request_as_provider(p_provider_id uuid, p_request_id uuid, p_reason text, p_note text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_request public.requests;
begin
  if public.jwt_provider_role(p_provider_id) is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason not in ('fake', 'wrong_location', 'unreachable', 'unsafe', 'other') then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  select r.* into v_request from public.requests r
  where r.id = p_request_id
    and (r.assigned_provider_id = p_provider_id
         or exists (select 1 from public.dispatch_attempts d where d.request_id = r.id and d.provider_id = p_provider_id));
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  return public.record_request_flag(v_request, 'provider', p_reason, p_note, p_provider_id, 'provider');
end;
$$;
revoke all on function public.flag_request_as_provider(uuid, uuid, text, text) from public, anon;
grant execute on function public.flag_request_as_provider(uuid, uuid, text, text) to authenticated;

-- Staff close a flag with a short note (dispatchers, operations and support).
create function public.resolve_request_flag(p_id uuid, p_resolution text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_flag public.request_flags;
begin
  select * into v_flag from public.request_flags where id = p_id;
  if not found or not public.staff_can_access_market(v_flag.market_id)
     or public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'dispatcher', 'support') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.request_flags
  set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
      resolution = nullif(left(trim(coalesce(p_resolution, '')), 500), '')
  where id = p_id and status = 'open';
  insert into public.request_events (request_id, event_type, actor_type, actor_id, data)
  values (v_flag.request_id, 'flag_resolved', 'staff', auth.uid(), jsonb_build_object('flag_id', p_id));
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'flag.resolve', 'request_flag', p_id::text,
          jsonb_build_object('request_id', v_flag.request_id));
end;
$$;
revoke all on function public.resolve_request_flag(uuid, text) from public, anon;
grant execute on function public.resolve_request_flag(uuid, text) to authenticated;

-- Counts for the profiles and for RSOS-117 (fraud signals, reliability scores). Test traffic is
-- left out. A provider's count is what customers reported about them; a customer (by phone) is
-- what providers reported about them.
create function public.request_flag_counts(p_provider_id uuid, p_phone text)
returns table (side text, reason text, open_count integer, total integer)
language sql stable security invoker set search_path = '' as $$
  select f.side, f.reason, count(*) filter (where f.status = 'open')::int, count(*)::int
  from public.request_flags f
  join public.requests r on r.id = f.request_id
  where not f.is_test
    and ((p_provider_id is not null and f.side = 'customer' and f.provider_id = p_provider_id)
      or (p_phone is not null and f.side = 'provider' and r.driver_phone = p_phone))
  group by f.side, f.reason;
$$;
revoke all on function public.request_flag_counts(uuid, text) from public, anon;
grant execute on function public.request_flag_counts(uuid, text) to authenticated;

-- The admin Inbox reloads when a flag arrives or is resolved.
alter publication supabase_realtime add table public.request_flags;
