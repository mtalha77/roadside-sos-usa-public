-- RSOS-110: the product is online booking first, phone second. A market's go-live checklist no
-- longer requires phone numbers or a 24/7 phone schedule (both stay on the list as optional);
-- it now requires the booking flow to have been tested end to end in that market: a test booking
-- that reached a provider and was then cancelled as "test".
drop function public.market_launch_checklist(uuid);
create function public.market_launch_checklist(p_market_id uuid)
returns table (item text, ok boolean, detail text, required boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_min int;
  v_short text;
begin
  if public.jwt_staff_role() is null or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select min_providers_per_service into v_min from public.markets where id = p_market_id;

  select string_agg(s.slug::text || ' ' || coalesce(n.cnt, 0) || '/' || v_min, ', ' order by s.sort_order)
    into v_short
  from public.current_market_services cms
  join public.services s on s.id = cms.service_id
  left join lateral (
    select count(distinct sp.provider_id)::int as cnt
    from public.provider_service_prices sp
    join public.providers pr on pr.id = sp.provider_id and pr.status = 'active' and not pr.is_demo
    where sp.market_id = p_market_id and sp.service_id = cms.service_id and sp.active
  ) n on true
  where cms.market_id = p_market_id and cms.enabled and coalesce(n.cnt, 0) < v_min;
  return query select 'providers'::text, v_short is null, v_short, true;

  return query select 'prices'::text,
    exists (select 1 from public.current_market_services c where c.market_id = p_market_id and c.enabled)
    and not exists (select 1 from public.current_market_services c where c.market_id = p_market_id and c.enabled
                    and (c.platform_fee_cents is null or c.price_min_cents is null or c.price_max_cents is null)),
    null::text, true;

  return query select 'landing_pages'::text,
    exists (select 1 from public.market_pages mp where mp.market_id = p_market_id and mp.locale = 'en'),
    null::text, true;

  return query select 'tracking'::text,
    exists (select 1 from public.conversion_events c where c.market_id = p_market_id
            and c.occurred_at > now() - interval '30 days'),
    null::text, true;

  return query select 'booking_test'::text,
    exists (select 1 from public.requests r where r.market_id = p_market_id
            and r.accepted_at is not null and r.status = 'cancelled'
            and r.end_reason in ('test', 'test cleanup') and r.created_at > now() - interval '90 days'),
    null::text, true;

  -- Optional: calls are a backup channel.
  return query select 'numbers'::text,
    exists (select 1 from public.market_phone_numbers p where p.market_id = p_market_id and p.is_active and p.purpose = 'website')
    and exists (select 1 from public.market_phone_numbers p where p.market_id = p_market_id and p.is_active and p.purpose = 'google_ads'),
    null::text, false;
  return query select 'on_duty'::text, public.market_dispatch_covered(p_market_id), null::text, false;
end;
$$;
revoke all on function public.market_launch_checklist(uuid) from public, anon;
grant execute on function public.market_launch_checklist(uuid) to authenticated;

-- Going live checks only the required items (super admins can still override with a reason).
create or replace function public.set_market_status(p_market_id uuid, p_status public.market_status, p_override_reason text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_missing text[];
  v_old public.market_status;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_old from public.markets where id = p_market_id for update;
  if p_status = 'active' then
    select array_agg(c.item) into v_missing from public.market_launch_checklist(p_market_id) c where c.required and not c.ok;
    if v_missing is not null then
      if public.jwt_staff_role() <> 'super_admin' or p_override_reason is null or length(trim(p_override_reason)) < 5 then
        raise exception 'launch checklist incomplete: %', array_to_string(v_missing, ', ') using errcode = '22023';
      end if;
      insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
      values (auth.uid(), 'super_admin', 'market.live_override', 'market', p_market_id::text, p_market_id,
              jsonb_build_object('missing', v_missing, 'reason', trim(p_override_reason)));
    end if;
  end if;
  update public.markets set status = p_status where id = p_market_id;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'market.status', 'market', p_market_id::text, p_market_id,
          jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

-- The dispatch board shows each request's booking mode (Instant book and its ceiling).
drop function public.admin_live_requests(timestamptz);
create function public.admin_live_requests(p_since timestamptz default now() - interval '30 minutes')
returns table (
  id uuid, short_code text, status public.request_status, channel public.request_channel,
  market_slug text, service_slug text, driver_name text, driver_phone text,
  pickup_address text, lat double precision, lng double precision,
  created_at timestamptz, submitted_at timestamptz, quoted_at timestamptz, accepted_at timestamptz,
  en_route_at timestamptz, on_site_at timestamptz, status_token text,
  booking_mode text, instant_max_cents integer
)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.short_code, r.status, r.channel, m.slug::text, s.slug::text, r.driver_name, r.driver_phone,
         r.pickup_address,
         extensions.st_y(r.pickup_point::extensions.geometry), extensions.st_x(r.pickup_point::extensions.geometry),
         r.created_at, r.submitted_at, r.quoted_at, r.accepted_at, r.en_route_at, r.on_site_at, r.status_token,
         r.booking_mode, r.instant_max_cents
  from public.requests r
  join public.markets m on m.id = r.market_id
  join public.services s on s.id = r.service_id
  where r.status in ('submitted', 'quoting', 'quoted', 'accepted', 'en_route', 'on_site')
     or r.updated_at > p_since
  order by r.created_at desc
  limit 500;
$$;
revoke all on function public.admin_live_requests(timestamptz) from public, anon;
grant execute on function public.admin_live_requests(timestamptz) to authenticated;
