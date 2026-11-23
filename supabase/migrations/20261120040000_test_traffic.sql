-- Owner decision 2 (2026-11-19): test traffic is tagged and kept out of analytics and ad
-- conversions in every environment. A session is test traffic when it started with ?rsos_test=1,
-- comes from an IP or device on the admin-managed test list, or comes from a browser where staff
-- are signed in. The website marks its database calls for such sessions with the request header
-- `x-rsos-test: 1`; the database reads it here (PostgREST exposes request headers per request).

alter table public.requests add column is_test boolean not null default false;
alter table public.funnel_events add column is_test boolean not null default false;

create function public.request_is_test() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-rsos-test', '') = '1';
$$;
grant execute on function public.request_is_test() to anon, authenticated;

-- Requests created by test traffic are tagged when they are inserted.
create function public.requests_mark_test() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.request_is_test() then new.is_test := true; end if;
  return new;
end;
$$;
create trigger requests_mark_test before insert on public.requests
  for each row execute function public.requests_mark_test();

-- Test traffic never produces conversion events (so never reaches an ad platform or a report).
create or replace function public.record_request_conversion(p_request_id uuid, p_name text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.conversion_events (event_id, name, market_id, service_slug, source, request_id,
                                        gclid, gbraid, wbraid, fbclid, msclkid, value_cents)
  select p_name || ':' || r.id, p_name, r.market_id, s.slug::text,
         coalesce(r.source::text, a.utm_source, case when a.gclid is not null then 'google_ads' end, r.channel::text),
         r.id, a.gclid, a.gbraid, a.wbraid, a.fbclid, a.msclkid,
         case when p_name in ('job_assigned', 'job_completed') then r.quoted_price_cents end
  from public.requests r
  left join public.services s on s.id = r.service_id
  left join public.attributions a on a.request_id = r.id
  where r.id = p_request_id and not r.is_test
  on conflict (event_id) do nothing;
$$;
revoke all on function public.record_request_conversion(uuid, text) from public, anon, authenticated;

-- Visits from test traffic are not counted.
create or replace function public.record_visit(p_market_slug text, p_source text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.site_visits as v (day, market_key, source, visits)
  select current_date, coalesce((select m.slug::text from public.markets m where m.slug = p_market_slug), ''), p_source, 1
  where p_source ~ '^[a-z_]{2,30}$' and not public.request_is_test()
  on conflict (day, market_key, source) do update set visits = v.visits + 1;
$$;

-- Funnel events from test traffic are kept but tagged (staging can include them on purpose).
create function public.funnel_events_mark_test() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.request_is_test() then new.is_test := true; end if;
  return new;
end;
$$;
create trigger funnel_events_mark_test before insert on public.funnel_events
  for each row execute function public.funnel_events_mark_test();

-- The website's booking-speed promise counts real bookings only.
create or replace function public.market_booking_speed(p_market_slug text)
returns table (bookings integer, median_minutes integer)
language sql stable security definer set search_path = '' as $$
  with m as (select id from public.markets where slug = p_market_slug::extensions.citext and status in ('test', 'active')),
  booked as (
    select extract(epoch from (r.accepted_at - coalesce(r.submitted_at, r.created_at))) / 60 as minutes
    from public.requests r join m on r.market_id = m.id
    where r.accepted_at is not null
      and r.accepted_at >= coalesce(r.submitted_at, r.created_at)
      and r.created_at > now() - interval '30 days'
      and r.driver_phone !~ '^\+1[0-9]{3}55501[0-9]{2}$'
      and coalesce(r.end_reason, '') <> 'test cleanup'
      and not r.is_test
  )
  select count(*)::int,
         case when count(*) >= 10 then greatest(1, round(percentile_cont(0.5) within group (order by minutes)))::int end
  from booked;
$$;

-- Test campaign: real requests only.
create or replace function public.campaign_requests(p_from timestamptz, p_to timestamptz)
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
  where r.created_at >= p_from and r.created_at < p_to and r.status <> 'draft' and not r.is_test;
$$;

-- The admin-managed test list: IP addresses (or ranges) and test devices. A device joins by
-- opening its one-time link on the website (/?rsos_test=<token>), which keeps a long-lived cookie.
create table public.test_traffic_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ip', 'device')),
  value text not null check (length(value) between 3 and 80),
  label text not null check (length(trim(label)) between 1 and 80),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (kind, value),
  check (kind <> 'ip' or value ~ '^[0-9a-fA-F:./]+$'),
  check (kind <> 'device' or value ~ '^[A-Za-z0-9_-]{24,64}$')
);
alter table public.test_traffic_rules enable row level security;
revoke all on public.test_traffic_rules from anon, authenticated;
grant select on public.test_traffic_rules to authenticated;
create policy "managers read the test list" on public.test_traffic_rules for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));

create function public.add_test_traffic_rule(p_kind text, p_value text, p_label text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'marketing') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind = 'ip' and (select p_value::inet) is null then raise exception 'invalid ip' using errcode = '22023'; end if;
  insert into public.test_traffic_rules (kind, value, label, created_by)
  values (p_kind, trim(p_value), trim(p_label), auth.uid()) returning id into v_id;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'test_traffic.add', 'test_traffic_rule', v_id::text,
          jsonb_build_object('kind', p_kind, 'label', trim(p_label)));
  return v_id;
end;
$$;
revoke all on function public.add_test_traffic_rule(text, text, text) from public, anon;
grant execute on function public.add_test_traffic_rule(text, text, text) to authenticated;

create function public.remove_test_traffic_rule(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'marketing') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.test_traffic_rules where id = p_id;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'test_traffic.remove', 'test_traffic_rule', p_id::text, '{}');
end;
$$;
revoke all on function public.remove_test_traffic_rule(uuid) from public, anon;
grant execute on function public.remove_test_traffic_rule(uuid) to authenticated;

-- The website asks only yes or no: is this IP, or this device token, on the test list?
create function public.is_test_traffic(p_ip text, p_device text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.test_traffic_rules t
    where (t.kind = 'ip' and p_ip ~ '^[0-9a-fA-F:.]+$' and t.value::inet >>= p_ip::inet)
       or (t.kind = 'device' and t.value = p_device)
  );
$$;
revoke all on function public.is_test_traffic(text, text) from public;
grant execute on function public.is_test_traffic(text, text) to anon, authenticated;
