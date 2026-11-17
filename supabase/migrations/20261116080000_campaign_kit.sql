-- RSOS-089-prep: the test campaign kit. A real launch checklist per market that blocks going live
-- until every item is green (super admins can override with a reason, logged), and the data the
-- campaign analytics view reads.

alter table public.markets
  add column min_providers_per_service integer not null default 3
    check (min_providers_per_service between 1 and 50);

-- True when the market's on-duty shifts cover every minute of every day (24/7 coverage).
create function public.market_dispatch_covered(p_market_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  d int;
  reach int;
  s record;
begin
  for d in 0..6 loop
    reach := 0;
    for s in
      select f.start_minute, f.end_minute
      from public.dispatcher_shifts f
      join public.staff_members m on m.user_id = f.user_id and m.is_active
      where f.weekday = d
        and (m.market_ids is null or p_market_id = any (m.market_ids))
      order by f.start_minute
    loop
      if s.start_minute > reach then exit; end if;
      reach := greatest(reach, s.end_minute);
    end loop;
    if reach < 1440 then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.market_dispatch_covered(uuid) from public, anon;
grant execute on function public.market_dispatch_covered(uuid) to authenticated;

-- The checklist: one row per item, with a short detail for what is missing.
create function public.market_launch_checklist(p_market_id uuid)
returns table (item text, ok boolean, detail text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_min int;
  v_short text;
begin
  if public.jwt_staff_role() is null or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select min_providers_per_service into v_min from public.markets where id = p_market_id;

  return query select 'numbers'::text,
    exists (select 1 from public.market_phone_numbers p where p.market_id = p_market_id and p.is_active and p.purpose = 'website')
    and exists (select 1 from public.market_phone_numbers p where p.market_id = p_market_id and p.is_active and p.purpose = 'google_ads'),
    null::text;

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
  return query select 'providers'::text, v_short is null, v_short;

  return query select 'prices'::text,
    exists (select 1 from public.current_market_services c where c.market_id = p_market_id and c.enabled)
    and not exists (select 1 from public.current_market_services c where c.market_id = p_market_id and c.enabled
                    and (c.platform_fee_cents is null or c.price_min_cents is null or c.price_max_cents is null)),
    null::text;

  return query select 'on_duty'::text, public.market_dispatch_covered(p_market_id), null::text;

  return query select 'landing_pages'::text,
    exists (select 1 from public.market_pages mp where mp.market_id = p_market_id and mp.locale = 'en'),
    null::text;

  return query select 'tracking'::text,
    exists (select 1 from public.conversion_events c where c.market_id = p_market_id
            and c.occurred_at > now() - interval '30 days'),
    null::text;
end;
$$;
revoke all on function public.market_launch_checklist(uuid) from public, anon;
grant execute on function public.market_launch_checklist(uuid) to authenticated;

-- Changing a market's status. Going live needs every checklist item green, or a super admin's
-- override with a reason (written to the audit log).
create function public.set_market_status(p_market_id uuid, p_status public.market_status, p_override_reason text default null)
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
    select array_agg(c.item) into v_missing from public.market_launch_checklist(p_market_id) c where not c.ok;
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
revoke all on function public.set_market_status(uuid, public.market_status, text) from public, anon;
grant execute on function public.set_market_status(uuid, public.market_status, text) to authenticated;

-- Campaign analytics rows: one per request in a window, with the times the view needs
-- (RLS through the caller: staff see their markets).
create function public.campaign_requests(p_from timestamptz, p_to timestamptz)
returns table (market_id uuid, request_id uuid, status public.request_status, channel public.request_channel,
               created_at timestamptz, contacted_at timestamptz, assigned_at timestamptz, completed_at timestamptz,
               quoted_price_cents integer, fee_cents integer)
language sql stable security invoker set search_path = '' as $$
  select r.market_id, r.id, r.status, r.channel, r.created_at,
         coalesce(r.contacted_at,
                  (select min(c.answered_at) from public.calls c where c.request_id = r.id),
                  (select min(m.created_at) from public.sms_messages m where m.request_id = r.id and m.direction = 'outbound' and m.staff_user_id is not null)),
         r.assigned_at, r.completed_at, r.quoted_price_cents,
         (select sum(b.amount_cents)::int from public.provider_billing_events b where b.request_id = r.id and b.kind = 'manual_test')
  from public.requests r
  where r.created_at >= p_from and r.created_at < p_to and r.status <> 'draft';
$$;
revoke all on function public.campaign_requests(timestamptz, timestamptz) from public, anon;
grant execute on function public.campaign_requests(timestamptz, timestamptz) to authenticated;
