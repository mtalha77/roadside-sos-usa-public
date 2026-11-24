-- Owner decision (release 1): Sentry may stay off for the soft launch, but it must be live in all
-- three apps before any paid ads start. "Sentry live" is a required item of every market's go-live
-- checklist, and no ad platform can be switched on without it.
--
-- The database cannot see the apps' settings, so the admin app checks the three /api/health
-- endpoints with the service role and records the result in platform_checks. A result older than a
-- day no longer counts.

create table public.platform_checks (
  key text primary key check (key ~ '^[a-z][a-z_]{1,39}$'),
  ok boolean not null,
  detail text check (length(detail) <= 300),
  checked_at timestamptz not null default now()
);
alter table public.platform_checks enable row level security;
-- Staff read; only the service role (admin server code) writes. No policy for writes.
create policy "staff read platform checks" on public.platform_checks for select to authenticated
  using (public.jwt_staff_role() is not null);

create function public.platform_check_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.ok and c.checked_at > now() - interval '1 day'
                   from public.platform_checks c where c.key = p_key), false);
$$;
revoke all on function public.platform_check_ok(text) from public, anon;
grant execute on function public.platform_check_ok(text) to authenticated;

create or replace function public.market_launch_checklist(p_market_id uuid)
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

  -- Owner decision (release 1): error tracking (Sentry) live in all three apps before any paid ads.
  return query select 'sentry'::text, public.platform_check_ok('sentry'),
    (select c.detail from public.platform_checks c where c.key = 'sentry'), true;

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

-- Switching a platform on needs Sentry live; switching off is always allowed.
create or replace function public.set_ad_connection(p_platform text, p_enabled boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'marketing') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_enabled and not public.platform_check_ok('sentry') then
    raise exception 'sentry not live: paid ads need error tracking in all three apps' using errcode = '22023';
  end if;
  update public.ad_connections set enabled = p_enabled, updated_by = auth.uid(), updated_at = now() where platform = p_platform;
  if not found then raise exception 'unknown platform' using errcode = '22023'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'ads.connection', 'ad_connection', p_platform, jsonb_build_object('enabled', p_enabled));
end;
$$;
revoke all on function public.set_ad_connection(text, boolean) from public, anon;
grant execute on function public.set_ad_connection(text, boolean) to authenticated;
