-- RSOS-034b: real inbox and manual dispatch for the test campaign. Providers get a dispatch
-- phone, base and radius and per-service prices; dispatchers record each call to a provider,
-- assign the job and move it through the steps. Assigning writes a manual_test fee row.

-- ---------------------------------------------------------------------------------------------
-- Providers: how dispatchers reach them, where they work, what they charge
-- ---------------------------------------------------------------------------------------------
alter table public.providers
  add column dispatch_phone public.us_phone,
  add column base_point extensions.geography(point, 4326),
  add column service_radius_miles integer check (service_radius_miles between 1 and 200);

create table public.provider_service_prices (
  provider_id uuid not null references public.providers (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  price_cents integer not null check (price_cents between 0 and 1000000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (provider_id, market_id, service_id)
);
alter table public.provider_service_prices enable row level security;
create policy "staff read provider prices" on public.provider_service_prices for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "operations edit provider prices" on public.provider_service_prices for all to authenticated
  using (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher'))
  with check (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher'));
create policy "providers read their prices" on public.provider_service_prices for select to authenticated
  using (public.jwt_provider_role(provider_id) is not null);

create policy "operations edit provider dispatch details" on public.providers for update to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher'));

-- ---------------------------------------------------------------------------------------------
-- Requests: who was assigned, at what price and ETA, and the manual steps' times
-- ---------------------------------------------------------------------------------------------
alter table public.requests
  add column assigned_provider_id uuid references public.providers (id) on delete set null,
  add column quoted_price_cents integer check (quoted_price_cents between 0 and 1000000),
  add column quoted_eta_minutes integer check (quoted_eta_minutes between 1 and 600),
  add column contacted_at timestamptz,
  add column location_confirmed_at timestamptz,
  add column assigned_at timestamptz,
  add column no_provider_at timestamptz,
  add column end_reason text check (length(end_reason) between 3 and 500);

-- ---------------------------------------------------------------------------------------------
-- Dispatch attempts: every provider call a dispatcher makes for a request
-- ---------------------------------------------------------------------------------------------
create type public.dispatch_outcome as enum ('no_answer', 'declined', 'quoted', 'assigned');
create table public.dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  staff_user_id uuid references auth.users (id) on delete set null,
  outcome public.dispatch_outcome not null,
  quoted_price_cents integer check (quoted_price_cents between 0 and 1000000),
  quoted_eta_minutes integer check (quoted_eta_minutes between 1 and 600),
  -- Seconds from the dispatcher's call to the provider's answer (for "last response time").
  response_sec integer check (response_sec >= 0),
  created_at timestamptz not null default now()
);
create index dispatch_attempts_request_idx on public.dispatch_attempts (request_id, created_at);
create index dispatch_attempts_provider_idx on public.dispatch_attempts (provider_id, created_at desc);
alter table public.dispatch_attempts enable row level security;
create policy "staff read dispatch attempts" on public.dispatch_attempts for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "dispatchers record attempts" on public.dispatch_attempts for insert to authenticated
  with check (public.staff_can_access_market(market_id)
              and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher')
              and staff_user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Saved replies (texts with placeholders), editable by managers
-- ---------------------------------------------------------------------------------------------
create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 2 and 80),
  body text not null check (length(body) between 2 and 640),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.saved_replies enable row level security;
create policy "staff read saved replies" on public.saved_replies for select to authenticated
  using (public.jwt_staff_role() is not null);
create policy "managers edit saved replies" on public.saved_replies for all to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager'));
insert into public.saved_replies (title, body, sort_order) values
  ('Share location', 'Hi {first_name}, this is dispatch. Please share your exact location here: {link}', 1),
  ('Provider on the way', 'Hi {first_name}, {provider} is on the way. Quoted price {price}, about {eta} min. Track here: {link}', 2),
  ('Still looking', 'Hi {first_name}, we are still finding a provider near you. We will text you as soon as one confirms.', 3),
  ('Safety', 'If you feel unsafe or are in traffic, please call 911 first. We will keep working on your help.', 4);

-- ---------------------------------------------------------------------------------------------
-- Nearby providers for a request (manual dispatch list)
-- ---------------------------------------------------------------------------------------------
create function public.nearby_providers(p_request_id uuid)
returns table (provider_id uuid, name text, dispatch_phone text, distance_miles numeric,
               in_radius boolean, price_cents integer, last_response_sec integer, acceptance_rate numeric)
language sql stable security invoker set search_path = '' as $$
  with r as (select id, market_id, service_id, pickup_point from public.requests where id = p_request_id)
  select p.id, p.name, p.dispatch_phone::text,
         case when r.pickup_point is null or p.base_point is null then null
              else round((extensions.st_distance(p.base_point, r.pickup_point) / 1609.344)::numeric, 1) end,
         case when r.pickup_point is null or p.base_point is null or p.service_radius_miles is null then null
              else extensions.st_dwithin(p.base_point, r.pickup_point, p.service_radius_miles * 1609.344) end,
         sp.price_cents,
         (select a.response_sec from public.dispatch_attempts a
           where a.provider_id = p.id and a.response_sec is not null order by a.created_at desc limit 1),
         (select round(count(*) filter (where a.outcome in ('quoted', 'assigned'))::numeric / nullif(count(*), 0), 2)
            from public.dispatch_attempts a where a.provider_id = p.id)
  from r
  join public.providers p on p.status = 'active' and not p.is_demo and r.market_id = any (p.market_ids)
  left join public.provider_service_prices sp
    on sp.provider_id = p.id and sp.market_id = r.market_id and sp.service_id = r.service_id and sp.active
  where r.service_id is null or sp.provider_id is not null
  order by 4 nulls last, p.name;
$$;
revoke all on function public.nearby_providers(uuid) from public, anon;
grant execute on function public.nearby_providers(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Claims: one dispatcher owns a request; a claim lapses after 10 minutes without action
-- ---------------------------------------------------------------------------------------------
create function public.claim_request(p_request_id uuid, p_force boolean default false)
returns boolean
language plpgsql volatile security invoker set search_path = '' as $$
declare v_ok boolean;
begin
  update public.requests r
     set assigned_dispatcher_id = auth.uid(), claimed_at = now()
   where r.id = p_request_id
     and (p_force or r.assigned_dispatcher_id is null or r.assigned_dispatcher_id = auth.uid()
          or r.claimed_at < now() - interval '10 minutes');
  v_ok := found;
  if v_ok then
    insert into public.request_events (request_id, event_type, actor_type, actor_id)
    values (p_request_id, 'claimed', 'staff', auth.uid());
  end if;
  return v_ok;
end;
$$;
revoke all on function public.claim_request(uuid, boolean) from public, anon;
grant execute on function public.claim_request(uuid, boolean) to authenticated;

-- Staff append notes and events on requests they can see (requests' own update policy decides).
create policy "staff add request events" on public.request_events for insert to authenticated
  with check (actor_type = 'staff' and actor_id = auth.uid()
              and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher', 'support')
              and exists (select 1 from public.requests r where r.id = request_id and public.staff_can_access_market(r.market_id)));

-- ---------------------------------------------------------------------------------------------
-- Manual status steps, with times, reasons, events and the manual_test fee on assignment
-- ---------------------------------------------------------------------------------------------
create function public.dispatch_step(
  p_request_id uuid, p_status public.request_status, p_reason text default null,
  p_provider_id uuid default null, p_price_cents integer default null, p_eta_minutes integer default null)
returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_req public.requests;
  v_order constant text[] := array['phone_intake', 'submitted', 'contacted', 'location_confirmed', 'assigned', 'en_route', 'on_site', 'completed'];
  v_from int;
  v_to int;
  v_fee integer;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_req.status in ('completed', 'cancelled', 'no_provider', 'expired') then
    raise exception 'request is closed' using errcode = '22023';
  end if;
  if p_status in ('cancelled', 'no_provider') then
    if p_reason is null or length(trim(p_reason)) < 3 then
      raise exception 'a reason is required' using errcode = '22023';
    end if;
  else
    v_from := array_position(v_order, v_req.status::text);
    v_to := array_position(v_order, p_status::text);
    if v_to is null or (v_from is not null and v_to <= v_from) then
      raise exception 'steps only move forward' using errcode = '22023';
    end if;
    if p_status in ('location_confirmed', 'assigned', 'en_route', 'on_site', 'completed')
       and (v_req.pickup_point is null or v_req.service_id is null) then
      raise exception 'confirm the location and service first' using errcode = '22023';
    end if;
  end if;
  if p_status = 'assigned' and (p_provider_id is null or p_price_cents is null or p_eta_minutes is null) then
    raise exception 'provider, price and ETA are required' using errcode = '22023';
  end if;

  update public.requests set
    status = p_status,
    claimed_at = now(),
    contacted_at = case when p_status = 'contacted' then now() else contacted_at end,
    location_confirmed_at = case when p_status = 'location_confirmed' then now() else location_confirmed_at end,
    assigned_at = case when p_status = 'assigned' then now() else assigned_at end,
    accepted_at = case when p_status = 'assigned' then now() else accepted_at end,
    en_route_at = case when p_status = 'en_route' then now() else en_route_at end,
    on_site_at = case when p_status = 'on_site' then now() else on_site_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    no_provider_at = case when p_status = 'no_provider' then now() else no_provider_at end,
    end_reason = case when p_status in ('cancelled', 'no_provider') then trim(p_reason) else end_reason end,
    assigned_provider_id = coalesce(p_provider_id, assigned_provider_id),
    quoted_price_cents = coalesce(p_price_cents, quoted_price_cents),
    quoted_eta_minutes = coalesce(p_eta_minutes, quoted_eta_minutes)
  where id = p_request_id;

  insert into public.request_events (request_id, event_type, from_status, to_status, actor_type, actor_id, data)
  values (p_request_id, 'status', v_req.status, p_status, 'staff', auth.uid(),
          jsonb_strip_nulls(jsonb_build_object('reason', p_reason, 'provider_id', p_provider_id,
                                               'price_cents', p_price_cents, 'eta_minutes', p_eta_minutes)));

  if p_status = 'assigned' then
    insert into public.dispatch_attempts (request_id, provider_id, market_id, staff_user_id, outcome, quoted_price_cents, quoted_eta_minutes)
    values (p_request_id, p_provider_id, v_req.market_id, auth.uid(), 'assigned', p_price_cents, p_eta_minutes);
    -- The fee this job would earn, from the price table; marked manual_test, nothing is charged.
    select cms.platform_fee_cents into v_fee from public.current_market_services cms
     where cms.market_id = v_req.market_id and cms.service_id = v_req.service_id;
    perform public.record_manual_test_fee(p_provider_id, coalesce(v_fee, v_req.platform_fee_cents, 0), p_request_id);
  end if;
end;
$$;
revoke all on function public.dispatch_step(uuid, public.request_status, text, uuid, integer, integer) from public, anon;
grant execute on function public.dispatch_step(uuid, public.request_status, text, uuid, integer, integer) to authenticated;

-- The fee ledger is append-only and has no staff insert policy; this definer function is the
-- only way a manual_test row gets in (called from dispatch_step above).
alter table public.provider_billing_events
  add column request_id uuid references public.requests (id) on delete set null;
create function public.record_manual_test_fee(p_provider_id uuid, p_amount_cents integer, p_request_id uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.provider_billing_events (provider_id, kind, amount_cents, request_id)
  values (p_provider_id, 'manual_test', p_amount_cents, p_request_id);
end;
$$;
revoke all on function public.record_manual_test_fee(uuid, integer, uuid) from public, anon;
grant execute on function public.record_manual_test_fee(uuid, integer, uuid) to authenticated;
create policy "finance and operations read fee rows" on public.provider_billing_events for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance', 'dispatcher'));

-- Live inbox: requests and their events stream to signed-in staff (RLS applies to Realtime).
alter publication supabase_realtime add table public.requests, public.request_events, public.dispatch_attempts;

-- The pickup point as numbers for the inbox map (caller's rights: staff see their markets).
create function public.request_point(p_request_id uuid)
returns table (lat double precision, lng double precision)
language sql stable security invoker set search_path = '' as $$
  select extensions.st_y(r.pickup_point::extensions.geometry), extensions.st_x(r.pickup_point::extensions.geometry)
  from public.requests r where r.id = p_request_id and r.pickup_point is not null;
$$;
revoke all on function public.request_point(uuid) from public, anon;
grant execute on function public.request_point(uuid) to authenticated;
