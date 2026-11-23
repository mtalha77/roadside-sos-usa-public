-- RSOS-107: automatic ad sync. Connections per platform (switches; keys stay in the server
-- environment and are never stored here), imported spend per campaign and day, campaign to market
-- mapping, the conversion upload log (idempotent per platform and event), auto-pause rules and
-- their log, and sync runs for System status. Every table: RLS for the owner and marketing.

alter table public.markets add column ad_code text unique check (ad_code is null or ad_code ~ '^[A-Z0-9]{2,6}$');

create table public.ad_connections (
  platform text primary key check (platform in ('google_ads', 'meta', 'microsoft_ads')),
  enabled boolean not null default false,
  account_name text,
  last_sync_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 300),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.ad_connections (platform) values ('google_ads'), ('meta'), ('microsoft_ads');

create table public.ad_campaigns (
  platform text not null check (platform in ('google_ads', 'meta', 'microsoft_ads')),
  campaign_id text not null check (length(campaign_id) between 1 and 64),
  name text not null check (length(name) <= 255),
  -- From the naming rule ("SA | Tow | Search"), or set by hand when the name does not match.
  market_id uuid references public.markets (id) on delete set null,
  service_slug text check (service_slug is null or service_slug ~ '^[a-z-]{2,40}$'),
  mapped_by_hand boolean not null default false,
  paused_by_auto boolean not null default false,
  seen_at timestamptz not null default now(),
  primary key (platform, campaign_id)
);

create table public.ad_spend_daily (
  platform text not null check (platform in ('google_ads', 'meta', 'microsoft_ads')),
  campaign_id text not null,
  day date not null,
  market_id uuid references public.markets (id) on delete set null,
  service_slug text,
  spend_cents integer not null check (spend_cents >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  imported_at timestamptz not null default now(),
  primary key (platform, campaign_id, day)
);
create index ad_spend_daily_market_day_idx on public.ad_spend_daily (market_id, day);

create table public.ad_conversion_uploads (
  platform text not null check (platform in ('google_ads', 'meta', 'microsoft_ads')),
  event_id text not null references public.conversion_events (event_id) on delete cascade,
  status text not null check (status in ('sent', 'failed')),
  attempts integer not null default 1 check (attempts >= 1),
  last_attempt_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  response jsonb,
  primary key (platform, event_id)
);

create table public.ad_pause_rules (
  market_id uuid primary key references public.markets (id) on delete cascade,
  enabled boolean not null default false,
  min_providers integer not null default 1 check (min_providers between 1 and 50),
  grace_minutes integer not null default 10 check (grace_minutes between 0 and 240),
  start_hour integer not null default 0 check (start_hour between 0 and 23),
  end_hour integer not null default 24 check (end_hour between 1 and 24),
  state jsonb not null default '{"pausedServices": [], "shortSince": {}}',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.ad_pause_events (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id) on delete cascade,
  service_slug text not null,
  action text not null check (action in ('pause', 'resume')),
  campaigns text[] not null default '{}',
  at timestamptz not null default now()
);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  job text not null check (job ~ '^[a-z_:]{3,60}$'),
  ok boolean not null,
  details jsonb not null default '{}',
  error text check (error is null or length(error) <= 500),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);
create index sync_runs_job_idx on public.sync_runs (job, started_at desc);

alter table public.ad_connections enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_spend_daily enable row level security;
alter table public.ad_conversion_uploads enable row level security;
alter table public.ad_pause_rules enable row level security;
alter table public.ad_pause_events enable row level security;
alter table public.sync_runs enable row level security;
revoke all on public.ad_connections, public.ad_campaigns, public.ad_spend_daily, public.ad_conversion_uploads,
  public.ad_pause_rules, public.ad_pause_events, public.sync_runs from anon, authenticated;
grant select on public.ad_connections, public.ad_campaigns, public.ad_spend_daily, public.ad_conversion_uploads,
  public.ad_pause_rules, public.ad_pause_events, public.sync_runs to authenticated;

create policy "marketing reads connections" on public.ad_connections for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'read_only'));
create policy "marketing reads campaigns" on public.ad_campaigns for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'read_only'));
create policy "marketing reads imported spend" on public.ad_spend_daily for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'finance', 'read_only')
         and (market_id is null or public.staff_can_access_market(market_id)));
create policy "marketing reads the upload log" on public.ad_conversion_uploads for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'marketing'));
create policy "managers read pause rules" on public.ad_pause_rules for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing') and public.staff_can_access_market(market_id));
create policy "managers read pause events" on public.ad_pause_events for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing') and public.staff_can_access_market(market_id));
create policy "staff read sync runs" on public.sync_runs for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));

-- Owner and marketing switch a platform on or off (keys come from the server environment).
create function public.set_ad_connection(p_platform text, p_enabled boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'marketing') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.ad_connections set enabled = p_enabled, updated_by = auth.uid(), updated_at = now() where platform = p_platform;
  if not found then raise exception 'unknown platform' using errcode = '22023'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'ads.connection', 'ad_connection', p_platform, jsonb_build_object('enabled', p_enabled));
end;
$$;
revoke all on function public.set_ad_connection(text, boolean) from public, anon;
grant execute on function public.set_ad_connection(text, boolean) to authenticated;

-- A campaign mapped by hand (when its name does not follow the naming rule).
create function public.map_ad_campaign(p_platform text, p_campaign_id text, p_market_id uuid, p_service text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'marketing')
     or (p_market_id is not null and not public.staff_can_access_market(p_market_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.ad_campaigns set market_id = p_market_id, service_slug = nullif(p_service, ''), mapped_by_hand = p_market_id is not null
   where platform = p_platform and campaign_id = p_campaign_id;
  update public.ad_spend_daily set market_id = p_market_id, service_slug = nullif(p_service, '')
   where platform = p_platform and campaign_id = p_campaign_id;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'ads.campaign_mapped', 'ad_campaign', p_platform || ':' || p_campaign_id,
          p_market_id, jsonb_build_object('service', p_service));
end;
$$;
revoke all on function public.map_ad_campaign(text, text, uuid, text) from public, anon;
grant execute on function public.map_ad_campaign(text, text, uuid, text) to authenticated;

-- A market's short code for the campaign naming rule ("SA" in "SA | Tow | Search").
create function public.set_market_ad_code(p_market_id uuid, p_code text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'marketing') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.markets set ad_code = nullif(upper(trim(p_code)), '') where id = p_market_id;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'ads.market_code', 'market', p_market_id::text, p_market_id,
          jsonb_build_object('code', upper(trim(p_code))));
end;
$$;
revoke all on function public.set_market_ad_code(uuid, text) from public, anon;
grant execute on function public.set_market_ad_code(uuid, text) to authenticated;

-- Auto-pause rule per market: off by default; the owner and operations managers change it.
create function public.set_ad_pause_rule(p_market_id uuid, p_enabled boolean, p_min_providers integer,
                                         p_grace_minutes integer, p_start_hour integer, p_end_hour integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'marketing') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.ad_pause_rules (market_id, enabled, min_providers, grace_minutes, start_hour, end_hour, updated_by)
  values (p_market_id, p_enabled, p_min_providers, p_grace_minutes, p_start_hour, p_end_hour, auth.uid())
  on conflict (market_id) do update set enabled = excluded.enabled, min_providers = excluded.min_providers,
    grace_minutes = excluded.grace_minutes, start_hour = excluded.start_hour, end_hour = excluded.end_hour,
    updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'ads.pause_rule', 'market', p_market_id::text, p_market_id,
          jsonb_build_object('enabled', p_enabled, 'min_providers', p_min_providers, 'grace_minutes', p_grace_minutes,
                             'start_hour', p_start_hour, 'end_hour', p_end_hour));
end;
$$;
revoke all on function public.set_ad_pause_rule(uuid, boolean, integer, integer, integer, integer) from public, anon;
grant execute on function public.set_ad_pause_rule(uuid, boolean, integer, integer, integer, integer) to authenticated;

-- The marketing dashboard per market, channel and day: imported spend first, the manual form only
-- for days with no import (RSOS-031's ad_spend uses 'bing' for Microsoft).
create function public.ad_dashboard_rows(p_from date, p_to date)
returns table (day date, market_id uuid, channel text, spend_cents bigint, clicks bigint, calls bigint,
               qualified_calls bigint, requests bigint, assigned bigint, completed bigint, fees_cents bigint, spend_source text)
language sql stable security definer set search_path = '' as $$
  with imp as (
    select s.day, s.market_id, s.platform as channel, sum(s.spend_cents)::bigint as spend_cents, sum(s.clicks)::bigint as clicks
    from public.ad_spend_daily s
    where s.day between p_from and p_to and s.market_id is not null
    group by 1, 2, 3),
  man as (
    select m.day, m.market_id, case m.channel when 'bing' then 'microsoft_ads' else m.channel end as channel,
           sum(m.amount_cents)::bigint as spend_cents
    from public.ad_spend m where m.day between p_from and p_to group by 1, 2, 3),
  sp as (
    select i.day, i.market_id, i.channel, i.spend_cents, i.clicks, 'imported'::text as src from imp i
    union all
    select m.day, m.market_id, m.channel, m.spend_cents, 0::bigint, 'manual' from man m
    where not exists (select 1 from imp i where i.day = m.day and i.market_id = m.market_id and i.channel = m.channel)),
  ev as (
    select (c.occurred_at at time zone 'UTC')::date as day, c.market_id,
           case when c.gclid is not null or c.gbraid is not null or c.wbraid is not null then 'google_ads'
                when c.fbclid is not null then 'meta' when c.msclkid is not null then 'microsoft_ads'
                else coalesce(nullif(c.source, ''), 'other') end as channel,
           count(*) filter (where c.name = 'call_started') as calls,
           count(*) filter (where c.name = 'call_qualified') as qualified_calls,
           count(*) filter (where c.name = 'request_submitted') as requests,
           count(*) filter (where c.name = 'job_assigned') as assigned,
           count(*) filter (where c.name = 'job_completed') as completed,
           coalesce(sum(r.platform_fee_cents) filter (where c.name = 'job_assigned'), 0) as fees_cents
    from public.conversion_events c left join public.requests r on r.id = c.request_id
    where c.occurred_at >= p_from and c.occurred_at < p_to + 1
    group by 1, 2, 3),
  keys as (select day, market_id, channel from sp union select day, market_id, channel from ev)
  select k.day, k.market_id, k.channel, coalesce(sp.spend_cents, 0), coalesce(sp.clicks, 0), coalesce(ev.calls, 0),
         coalesce(ev.qualified_calls, 0), coalesce(ev.requests, 0), coalesce(ev.assigned, 0), coalesce(ev.completed, 0),
         coalesce(ev.fees_cents, 0)::bigint, sp.src
  from keys k
  left join sp on sp.day = k.day and sp.market_id = k.market_id and sp.channel = k.channel
  left join ev on ev.day = k.day and ev.market_id = k.market_id and ev.channel = k.channel
  where k.market_id is not null
  order by 1, 2, 3;
$$;
revoke all on function public.ad_dashboard_rows(date, date) from public, anon, authenticated;

-- Staff see the markets they may access (marketing, finance, managers, viewers).
create function public.ad_dashboard(p_from date, p_to date)
returns table (day date, market_id uuid, channel text, spend_cents bigint, clicks bigint, calls bigint,
               qualified_calls bigint, requests bigint, assigned bigint, completed bigint, fees_cents bigint, spend_source text)
language sql stable security definer set search_path = '' as $$
  select * from public.ad_dashboard_rows(p_from, p_to) d
  where public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'finance', 'read_only')
    and public.staff_can_access_market(d.market_id);
$$;
revoke all on function public.ad_dashboard(date, date) from public, anon;
grant execute on function public.ad_dashboard(date, date) to authenticated;

-- The owner's daily email (cron with the service role): every market.
create function public.ad_dashboard_for_owner(p_from date, p_to date)
returns table (day date, market_id uuid, channel text, spend_cents bigint, clicks bigint, calls bigint,
               qualified_calls bigint, requests bigint, assigned bigint, completed bigint, fees_cents bigint, spend_source text)
language sql stable security definer set search_path = '' as $$
  select * from public.ad_dashboard_rows(p_from, p_to) where coalesce(auth.role(), '') = 'service_role';
$$;
revoke all on function public.ad_dashboard_for_owner(date, date) from public, anon, authenticated;
grant execute on function public.ad_dashboard_for_owner(date, date) to service_role;
