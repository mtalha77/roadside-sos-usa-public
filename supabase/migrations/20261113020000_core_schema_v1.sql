-- RSOS-016: core schema v1 for the website, phone line and test campaign. Many markets.
-- Every table has Row Level Security. Anonymous users cannot touch tables directly: public flows
-- go through the SECURITY DEFINER functions at the end of this file. Staff policies arrive in RSOS-018.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.market_status as enum ('draft', 'test', 'active', 'paused');
create type public.phone_purpose as enum ('website', 'google_ads', 'meta', 'microsoft', 'organic', 'provider_line');
create type public.vehicle_type as enum ('car', 'suv', 'pickup', 'motorcycle', 'van', 'rv');
create type public.request_status as enum ('draft', 'submitted', 'quoting', 'quoted', 'accepted', 'en_route', 'on_site', 'completed', 'cancelled', 'expired');
create type public.request_channel as enum ('web', 'phone', 'landing_page');
create type public.consent_type as enum ('terms', 'privacy', 'sms_transactional', 'sms_marketing', 'call_recording');
create type public.actor_type as enum ('system', 'driver', 'provider', 'staff');
create type public.application_status as enum ('new', 'reviewing', 'approved', 'rejected');
create type public.message_status as enum ('new', 'in_progress', 'handled');

-- E.164 US numbers only for now (+1 NXX NXX XXXX).
create domain public.us_phone as text check (value ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Blocks UPDATE and DELETE on history tables (fees, events, audit).
create function public.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% rows are append-only: insert a new row instead', tg_table_name using errcode = '0A000';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Markets and phone numbers
-- ---------------------------------------------------------------------------------------------
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 120),
  state_code char(2) not null check (state_code ~ '^[A-Z]{2}$'),
  time_zone text not null,
  center extensions.geography(point, 4326) not null,
  boundary extensions.geography(multipolygon, 4326) not null,
  status public.market_status not null default 'draft',
  -- e.g. {"always": true} or {"mon": ["06:00", "22:00"], ...} in the market's time zone.
  coverage_hours jsonb not null default '{"always": true}',
  support_phone public.us_phone,
  seo_title text,
  seo_intro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index markets_boundary_idx on public.markets using gist (boundary);
create trigger markets_updated_at before update on public.markets for each row execute function public.set_updated_at();

create table public.market_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  phone_number public.us_phone not null unique,
  purpose public.phone_purpose not null,
  twilio_sid text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index market_phone_numbers_market_idx on public.market_phone_numbers (market_id, purpose);

-- ---------------------------------------------------------------------------------------------
-- Services and dated, never-overwritten market prices and fees
-- ---------------------------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  icon_key text not null,
  needs_destination boolean not null default false,
  allowed_vehicle_types public.vehicle_type[] not null default array['car', 'suv', 'pickup', 'motorcycle', 'van', 'rv']::public.vehicle_type[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();

create table public.market_services (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  enabled boolean not null default true,
  price_min_cents integer check (price_min_cents >= 0),
  price_max_cents integer check (price_max_cents >= price_min_cents),
  price_note text,
  -- Flat fee the provider pays when the driver picks them. Null = not set yet (draft service).
  platform_fee_cents integer check (platform_fee_cents >= 0),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (market_id, service_id, effective_from),
  check (not enabled or platform_fee_cents is not null)
);
create trigger market_services_append_only before update or delete on public.market_services for each row execute function public.forbid_change();

-- The row in effect now for each market and service.
create view public.current_market_services with (security_invoker = true) as
select distinct on (ms.market_id, ms.service_id) ms.*
from public.market_services ms
where ms.effective_from <= now()
order by ms.market_id, ms.service_id, ms.effective_from desc;

-- ---------------------------------------------------------------------------------------------
-- Requests and their history
-- ---------------------------------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique check (short_code ~ '^R-[23456789A-HJ-NP-Z]{4,6}$'),
  -- Secret for the driver's status page (/r/<token>). Never shown in lists or logs.
  status_token text not null unique default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
  market_id uuid not null references public.markets (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  -- The fee row in effect when the request was made, and a snapshot of its fee.
  market_service_id uuid not null references public.market_services (id) on delete restrict,
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  status public.request_status not null default 'submitted',
  channel public.request_channel not null default 'web',
  driver_name text not null check (length(driver_name) between 1 and 120),
  driver_phone public.us_phone not null,
  driver_phone_verified boolean not null default false,
  pickup_point extensions.geography(point, 4326) not null,
  pickup_address text not null,
  pickup_note text,
  destination_point extensions.geography(point, 4326),
  destination_address text,
  vehicle_year smallint check (vehicle_year between 1950 and 2100),
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  vehicle_type public.vehicle_type,
  vehicle_is_ev boolean not null default false,
  safe_spot boolean,
  on_highway boolean,
  has_passengers boolean,
  keys_available boolean,
  spare_available boolean,
  notes text check (length(notes) <= 2000),
  assigned_dispatcher_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  quoted_at timestamptz,
  accepted_at timestamptz,
  en_route_at timestamptz,
  on_site_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz
);
create index requests_market_status_idx on public.requests (market_id, status, created_at desc);
create index requests_pickup_idx on public.requests using gist (pickup_point);
create trigger requests_updated_at before update on public.requests for each row execute function public.set_updated_at();

create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  event_type text not null,
  from_status public.request_status,
  to_status public.request_status,
  actor_type public.actor_type not null default 'system',
  actor_id uuid,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index request_events_request_idx on public.request_events (request_id, created_at);
create trigger request_events_append_only before update or delete on public.request_events for each row execute function public.forbid_change();

create table public.attributions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  msclkid text,
  landing_page text,
  referrer text,
  device text,
  -- SHA-256 of the IP with a server-side salt; the raw IP is not stored here.
  ip_hash text,
  call_id text,
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  phone public.us_phone not null,
  consent_type public.consent_type not null,
  granted boolean not null,
  policy_version text not null,
  ip inet,
  user_agent text,
  source text not null,
  request_id uuid references public.requests (id) on delete set null,
  created_at timestamptz not null default now()
);
create index consents_phone_idx on public.consents (phone, consent_type, created_at desc);
create trigger consents_append_only before update or delete on public.consents for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------------------------
-- Website forms
-- ---------------------------------------------------------------------------------------------
create table public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  phone public.us_phone not null,
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  market_ids uuid[] not null default '{}',
  service_ids uuid[] not null default '{}',
  truck_count integer check (truck_count between 1 and 1000),
  insurance_carrier text,
  license_number text,
  referral_source text,
  status public.application_status not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger provider_applications_updated_at before update on public.provider_applications for each row execute function public.set_updated_at();

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets (id) on delete set null,
  name text not null,
  email extensions.citext check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone public.us_phone,
  topic text,
  message text not null check (length(message) between 1 and 5000),
  status public.message_status not null default 'new',
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone public.us_phone,
  zip text check (zip ~ '^[0-9]{5}$'),
  city text,
  state_code char(2),
  point extensions.geography(point, 4326),
  source text,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  market_id uuid references public.markets (id) on delete set null,
  data jsonb not null default '{}',
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------------------------
-- Row Level Security on every table; no direct anonymous access at all
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['markets', 'market_phone_numbers', 'services', 'market_services', 'requests', 'request_events',
                           'attributions', 'consents', 'provider_applications', 'contact_messages', 'waitlist', 'audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;
revoke all on public.current_market_services from anon;
revoke all on all sequences in schema public from anon;

-- Future tables and functions: no automatic grants to anon.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------------------------------
-- Functions for the public website (the only way anonymous visitors reach data)
-- ---------------------------------------------------------------------------------------------

-- Market containing a point (any status; callers decide what to show). Null when outside all markets.
create function public.market_for_point(p_lat double precision, p_lng double precision)
returns table (id uuid, slug text, name text, state_code text, time_zone text, status public.market_status, support_phone text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.slug::text, m.name, m.state_code::text, m.time_zone, m.status, m.support_phone::text
  from public.markets m
  where m.status <> 'draft'
    and extensions.st_covers(m.boundary, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
  order by m.status = 'active' desc, m.name
  limit 1;
$$;

-- Published markets (test or active) for pages and menus.
create function public.list_public_markets()
returns table (id uuid, slug text, name text, state_code text, time_zone text, status public.market_status, support_phone text,
               seo_title text, seo_intro text, center_lat double precision, center_lng double precision)
language sql stable security definer set search_path = '' as $$
  select m.id, m.slug::text, m.name, m.state_code::text, m.time_zone, m.status, m.support_phone::text, m.seo_title, m.seo_intro,
         extensions.st_y(m.center::extensions.geometry), extensions.st_x(m.center::extensions.geometry)
  from public.markets m
  where m.status in ('test', 'active')
  order by m.name;
$$;

-- Current services, price ranges and fees for a published market.
create function public.get_market_services(p_market_slug text)
returns table (service_slug text, service_name text, icon_key text, needs_destination boolean, sort_order integer,
               enabled boolean, price_min_cents integer, price_max_cents integer, price_note text, platform_fee_cents integer)
language sql stable security definer set search_path = '' as $$
  select s.slug::text, s.name, s.icon_key, s.needs_destination, s.sort_order,
         cms.enabled, cms.price_min_cents, cms.price_max_cents, cms.price_note, cms.platform_fee_cents
  from public.markets m
  join public.current_market_services cms on cms.market_id = m.id
  join public.services s on s.id = cms.service_id
  where m.slug = p_market_slug::extensions.citext and m.status in ('test', 'active')
  order by s.sort_order, s.name;
$$;

create function public.generate_short_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := 'R-';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.requests r where r.short_code = code);
  end loop;
  return code;
end;
$$;

-- Creates a request with its attribution, consents and first event in ONE transaction.
-- Input (jsonb): service_slug, driver_name, driver_phone, pickup {lat, lng, address, note},
-- optional market_slug, channel, destination {lat, lng, address}, vehicle {...}, situation {...},
-- notes, attribution {...}, consents [{type, granted, policy_version}], consent_ip, user_agent, source.
create function public.create_request(p jsonb)
returns table (request_id uuid, short_code text, status_token text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_market public.markets%rowtype;
  v_service public.services%rowtype;
  v_ms public.current_market_services%rowtype;
  v_lat double precision := (p #>> '{pickup,lat}')::double precision;
  v_lng double precision := (p #>> '{pickup,lng}')::double precision;
  v_phone text := p ->> 'driver_phone';
  v_request public.requests%rowtype;
  v_consent jsonb;
begin
  if v_lat is null or v_lng is null or coalesce(p #>> '{pickup,address}', '') = '' then
    raise exception 'pickup location and address are required' using errcode = '22023';
  end if;
  if v_phone is null or v_phone !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$' then
    raise exception 'driver_phone must be a US number in E.164 format' using errcode = '22023';
  end if;

  if p ? 'market_slug' then
    select * into v_market from public.markets m where m.slug = (p ->> 'market_slug')::extensions.citext;
  else
    select m.* into v_market from public.markets m
    join public.market_for_point(v_lat, v_lng) f on f.id = m.id;
  end if;
  if v_market.id is null or v_market.status not in ('test', 'active') then
    raise exception 'location is outside our service area' using errcode = '22023';
  end if;

  select * into v_service from public.services s where s.slug = (p ->> 'service_slug')::extensions.citext;
  if v_service.id is null then
    raise exception 'unknown service' using errcode = '22023';
  end if;
  select * into v_ms from public.current_market_services c where c.market_id = v_market.id and c.service_id = v_service.id;
  if v_ms.id is null or not v_ms.enabled then
    raise exception 'service not available in this market' using errcode = '22023';
  end if;

  insert into public.requests (
    short_code, market_id, service_id, market_service_id, platform_fee_cents, status, channel,
    driver_name, driver_phone, pickup_point, pickup_address, pickup_note,
    destination_point, destination_address,
    vehicle_year, vehicle_make, vehicle_model, vehicle_color, vehicle_type, vehicle_is_ev,
    safe_spot, on_highway, has_passengers, keys_available, spare_available, notes, submitted_at
  ) values (
    public.generate_short_code(), v_market.id, v_service.id, v_ms.id, v_ms.platform_fee_cents, 'submitted',
    coalesce((p ->> 'channel')::public.request_channel, 'web'),
    p ->> 'driver_name', v_phone,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    p #>> '{pickup,address}', p #>> '{pickup,note}',
    case when p #> '{destination,lat}' is not null then
      extensions.st_setsrid(extensions.st_makepoint((p #>> '{destination,lng}')::double precision, (p #>> '{destination,lat}')::double precision), 4326)::extensions.geography
    end,
    p #>> '{destination,address}',
    (p #>> '{vehicle,year}')::smallint, p #>> '{vehicle,make}', p #>> '{vehicle,model}', p #>> '{vehicle,color}',
    (p #>> '{vehicle,type}')::public.vehicle_type, coalesce((p #>> '{vehicle,is_ev}')::boolean, false),
    (p #>> '{situation,safe_spot}')::boolean, (p #>> '{situation,on_highway}')::boolean, (p #>> '{situation,has_passengers}')::boolean,
    (p #>> '{situation,keys_available}')::boolean, (p #>> '{situation,spare_available}')::boolean,
    p ->> 'notes', now()
  ) returning * into v_request;

  insert into public.attributions (
    request_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, gbraid, wbraid, fbclid, msclkid,
    landing_page, referrer, device, ip_hash, call_id
  ) values (
    v_request.id, p #>> '{attribution,utm_source}', p #>> '{attribution,utm_medium}', p #>> '{attribution,utm_campaign}',
    p #>> '{attribution,utm_term}', p #>> '{attribution,utm_content}', p #>> '{attribution,gclid}', p #>> '{attribution,gbraid}',
    p #>> '{attribution,wbraid}', p #>> '{attribution,fbclid}', p #>> '{attribution,msclkid}', p #>> '{attribution,landing_page}',
    p #>> '{attribution,referrer}', p #>> '{attribution,device}', p #>> '{attribution,ip_hash}', p #>> '{attribution,call_id}'
  );

  for v_consent in select * from jsonb_array_elements(coalesce(p -> 'consents', '[]'::jsonb)) loop
    insert into public.consents (phone, consent_type, granted, policy_version, ip, user_agent, source, request_id)
    values (v_phone, (v_consent ->> 'type')::public.consent_type, (v_consent ->> 'granted')::boolean, v_consent ->> 'policy_version',
            (p ->> 'consent_ip')::inet, p ->> 'user_agent', coalesce(p ->> 'source', 'web'), v_request.id);
  end loop;

  insert into public.request_events (request_id, event_type, to_status, actor_type, data)
  values (v_request.id, 'created', 'submitted', 'driver', jsonb_build_object('channel', v_request.channel));

  return query select v_request.id, v_request.short_code, v_request.status_token;
end;
$$;

-- What the driver's status page may show. No phone, no exact location, no internal ids.
create function public.get_request_by_token(p_token text)
returns table (short_code text, status public.request_status, service_slug text, service_name text,
               market_slug text, market_name text, market_time_zone text, created_at timestamptz,
               submitted_at timestamptz, quoted_at timestamptz, accepted_at timestamptz, en_route_at timestamptz,
               on_site_at timestamptz, completed_at timestamptz, cancelled_at timestamptz, expired_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.short_code, r.status, s.slug::text, s.name, m.slug::text, m.name, m.time_zone, r.created_at,
         r.submitted_at, r.quoted_at, r.accepted_at, r.en_route_at, r.on_site_at, r.completed_at, r.cancelled_at, r.expired_at
  from public.requests r
  join public.services s on s.id = r.service_id
  join public.markets m on m.id = r.market_id
  where length(p_token) >= 24 and r.status_token = p_token;
$$;

revoke execute on function public.market_for_point(double precision, double precision), public.list_public_markets(),
  public.get_market_services(text), public.create_request(jsonb), public.get_request_by_token(text),
  public.generate_short_code(), public.set_updated_at(), public.forbid_change() from public, anon, authenticated;
grant execute on function public.market_for_point(double precision, double precision), public.list_public_markets(),
  public.get_market_services(text), public.create_request(jsonb), public.get_request_by_token(text) to anon, authenticated;
