-- RSOS-031: ad tracking and attribution. New-visitor counts per market and source, daily ad spend
-- entered by the owner, and conversion events written by triggers (deduplicated by event id) for
-- the marketing view, the Google Ads offline conversion file and server-side conversion APIs.

-- ---------------------------------------------------------------------------------------------
-- New visitors (first touch, once per browser per 90 days), counted per day, market and source
-- ---------------------------------------------------------------------------------------------
create table public.site_visits (
  day date not null,
  market_key text not null default '' check (length(market_key) <= 60),
  source text not null check (source ~ '^[a-z_]{2,30}$'),
  visits integer not null default 0 check (visits >= 0),
  primary key (day, market_key, source)
);
alter table public.site_visits enable row level security;
create policy "marketing reads visits" on public.site_visits for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'read_only'));

create function public.record_visit(p_market_slug text, p_source text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.site_visits as v (day, market_key, source, visits)
  select current_date, coalesce((select m.slug::text from public.markets m where m.slug = p_market_slug), ''), p_source, 1
  where p_source ~ '^[a-z_]{2,30}$'
  on conflict (day, market_key, source) do update set visits = v.visits + 1;
$$;
revoke all on function public.record_visit(text, text) from public;
grant execute on function public.record_visit(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Daily ad spend per market and channel (manual entry until the ad APIs are connected)
-- ---------------------------------------------------------------------------------------------
create table public.ad_spend (
  day date not null,
  market_id uuid not null references public.markets (id) on delete cascade,
  channel text not null check (channel in ('google_ads', 'meta', 'bing', 'gmb', 'other')),
  amount_cents integer not null check (amount_cents between 0 and 100000000),
  updated_at timestamptz not null default now(),
  primary key (day, market_id, channel)
);
alter table public.ad_spend enable row level security;
create policy "marketing reads spend" on public.ad_spend for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'finance', 'read_only')
         and public.staff_can_access_market(market_id));
create policy "marketing enters spend" on public.ad_spend for all to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'marketing') and public.staff_can_access_market(market_id))
  with check (public.jwt_staff_role() in ('super_admin', 'marketing') and public.staff_can_access_market(market_id));

-- ---------------------------------------------------------------------------------------------
-- Conversion events (server side, one per event id)
-- ---------------------------------------------------------------------------------------------
create table public.conversion_events (
  event_id text primary key check (length(event_id) between 5 and 120),
  name text not null check (name in ('request_submitted', 'call_started', 'call_qualified', 'job_assigned', 'job_completed')),
  market_id uuid not null references public.markets (id) on delete cascade,
  service_slug text,
  source text,
  request_id uuid references public.requests (id) on delete set null,
  call_id uuid references public.calls (id) on delete set null,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  msclkid text,
  value_cents integer,
  occurred_at timestamptz not null default now(),
  -- When each destination accepted it (null = not sent yet).
  meta_sent_at timestamptz,
  ga4_sent_at timestamptz
);
create index conversion_events_market_time_idx on public.conversion_events (market_id, occurred_at desc);
alter table public.conversion_events enable row level security;
create policy "marketing reads conversions" on public.conversion_events for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'read_only')
         and public.staff_can_access_market(market_id));

create function public.record_request_conversion(p_request_id uuid, p_name text) returns void
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
  where r.id = p_request_id
  on conflict (event_id) do nothing;
$$;
revoke all on function public.record_request_conversion(uuid, text) from public, anon, authenticated;

create function public.requests_conversions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.channel in ('web', 'landing_page') then
    perform public.record_request_conversion(new.id, 'request_submitted');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'assigned' or (new.status = 'accepted' and old.status <> 'assigned') then
      perform public.record_request_conversion(new.id, 'job_assigned');
    elsif new.status = 'completed' then
      perform public.record_request_conversion(new.id, 'job_completed');
    end if;
  end if;
  return new;
end;
$$;
-- After insert: the attribution row is written in the same transaction right after the request,
-- so the insert trigger is deferred to see it.
create constraint trigger requests_conversions_insert after insert on public.requests
  deferrable initially deferred for each row execute function public.requests_conversions();
create trigger requests_conversions_update after update of status on public.requests
  for each row execute function public.requests_conversions();

create function public.calls_conversions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.direction <> 'inbound' then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.conversion_events (event_id, name, market_id, source, request_id, call_id)
    values ('call_started:' || new.id, 'call_started', new.market_id, new.source::text, new.request_id, new.id)
    on conflict (event_id) do nothing;
  elsif coalesce(new.duration_sec, 0) > 60 and coalesce(old.duration_sec, 0) <= 60 then
    insert into public.conversion_events (event_id, name, market_id, source, request_id, call_id)
    values ('call_qualified:' || new.id, 'call_qualified', new.market_id, new.source::text, new.request_id, new.id)
    on conflict (event_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger calls_conversions after insert or update of duration_sec on public.calls
  for each row execute function public.calls_conversions();

-- ---------------------------------------------------------------------------------------------
-- Marketing view: per market and source for a date range (staff, their markets)
-- ---------------------------------------------------------------------------------------------
create function public.marketing_report(p_from date, p_to date)
returns table (market_id uuid, market_slug text, source text, visits bigint, calls bigint,
               qualified_calls bigint, forms bigint, requests bigint, assigned bigint, completed bigint,
               spend_cents bigint)
language sql stable security invoker set search_path = '' as $$
  with m as (select id, slug::text as slug from public.markets where public.staff_can_access_market(id)),
  ev as (
    select c.market_id, coalesce(c.source, 'unknown') as source,
           count(*) filter (where c.name = 'call_started') as calls,
           count(*) filter (where c.name = 'call_qualified') as qualified_calls,
           count(*) filter (where c.name = 'request_submitted') as forms,
           count(*) filter (where c.name = 'job_assigned') as assigned,
           count(*) filter (where c.name = 'job_completed') as completed
    from public.conversion_events c
    where c.occurred_at >= p_from and c.occurred_at < p_to + 1
    group by 1, 2),
  rq as (
    select r.market_id, coalesce(r.source::text, a.utm_source, case when a.gclid is not null then 'google_ads' end, r.channel::text, 'unknown') as source,
           count(*) as requests
    from public.requests r left join public.attributions a on a.request_id = r.id
    where r.created_at >= p_from and r.created_at < p_to + 1 and r.status <> 'draft'
    group by 1, 2),
  vi as (
    select m.id as market_id, v.source, sum(v.visits) as visits
    from public.site_visits v join m on m.slug = v.market_key
    where v.day between p_from and p_to group by 1, 2),
  sp as (
    select s.market_id, s.channel as source, sum(s.amount_cents) as spend_cents
    from public.ad_spend s where s.day between p_from and p_to group by 1, 2),
  keys as (
    select market_id, source from ev union select market_id, source from rq
    union select market_id, source from vi union select market_id, source from sp)
  select k.market_id, m.slug, k.source,
         coalesce(vi.visits, 0)::bigint, coalesce(ev.calls, 0), coalesce(ev.qualified_calls, 0),
         coalesce(ev.forms, 0), coalesce(rq.requests, 0), coalesce(ev.assigned, 0), coalesce(ev.completed, 0),
         coalesce(sp.spend_cents, 0)::bigint
  from keys k join m on m.id = k.market_id
  left join ev on ev.market_id = k.market_id and ev.source = k.source
  left join rq on rq.market_id = k.market_id and rq.source = k.source
  left join vi on vi.market_id = k.market_id and vi.source = k.source
  left join sp on sp.market_id = k.market_id and sp.source = k.source
  order by m.slug, k.source;
$$;
revoke all on function public.marketing_report(date, date) from public, anon;
grant execute on function public.marketing_report(date, date) to authenticated;
