-- RSOS-030: call tracking and the phone flow. Calls, intake requests, the on-duty schedule and
-- presence (RSOS-074b), location links (RSOS-023), texts and opt-outs (RSOS-035 builds on these),
-- and webhook idempotency. Webhooks write with the service role; staff read by market.

-- ---------------------------------------------------------------------------------------------
-- Tracking numbers (market_phone_numbers, one row per Twilio number) and per-market recording
-- ---------------------------------------------------------------------------------------------
alter table public.market_phone_numbers
  add column label text check (length(label) <= 80),
  add column synced_at timestamptz;
alter table public.markets
  add column call_recording_enabled boolean not null default false;

create policy "super admins manage phone numbers" on public.market_phone_numbers for all to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager') and public.staff_can_access_market(market_id))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager') and public.staff_can_access_market(market_id));

-- The number for a market and source (dynamic number insertion): that source's active number,
-- else the website number, else the support line.
create function public.market_phone_for_source(p_market_id uuid, p_source text)
returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.phone_number::text from public.market_phone_numbers p
      where p.market_id = p_market_id and p.purpose::text = p_source and p.is_active
      order by p.created_at limit 1),
    public.market_website_phone(p_market_id));
$$;
grant execute on function public.market_phone_for_source(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Requests: phone intake rows start without a service or location
-- ---------------------------------------------------------------------------------------------
alter table public.requests
  alter column service_id drop not null,
  alter column market_service_id drop not null,
  alter column pickup_point drop not null,
  alter column pickup_address drop not null,
  add column source public.phone_purpose,
  add column urgent boolean not null default false,
  add column claimed_at timestamptz,
  add constraint requests_complete_unless_intake check (
    status in ('phone_intake', 'contacted', 'cancelled', 'no_provider')
    or (service_id is not null and market_service_id is not null
        and pickup_point is not null and pickup_address is not null));

-- ---------------------------------------------------------------------------------------------
-- Calls
-- ---------------------------------------------------------------------------------------------
create type public.call_direction as enum ('inbound', 'outbound');
create type public.call_outcome as enum ('ringing', 'answered', 'missed', 'voicemail', 'busy', 'failed', 'completed');

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  twilio_call_sid text not null unique check (twilio_call_sid ~ '^CA[0-9a-fA-F]{32}$'),
  market_id uuid not null references public.markets (id) on delete restrict,
  tracking_number_id uuid references public.market_phone_numbers (id) on delete set null,
  direction public.call_direction not null,
  source public.phone_purpose,
  from_phone text not null check (length(from_phone) between 2 and 80),
  to_phone text not null check (length(to_phone) between 2 and 80),
  request_id uuid references public.requests (id) on delete set null,
  -- Dispatcher who answered (inbound) or placed (outbound) the call.
  staff_user_id uuid references auth.users (id) on delete set null,
  outcome public.call_outcome not null default 'ringing',
  answered_at timestamptz,
  ended_at timestamptz,
  duration_sec integer check (duration_sec >= 0),
  -- Recordings stay in Twilio; admins listen through an authenticated proxy (never a public URL).
  recording_sid text check (recording_sid ~ '^RE[0-9a-fA-F]{32}$'),
  recording_duration_sec integer,
  voicemail_transcript text check (length(voicemail_transcript) <= 4000),
  caller_line_type text,
  auto_text_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index calls_market_created_idx on public.calls (market_id, created_at desc);
create index calls_request_idx on public.calls (request_id);
alter table public.calls enable row level security;
create policy "staff read calls in their markets" on public.calls for select to authenticated
  using (public.staff_can_access_market(market_id));

-- ---------------------------------------------------------------------------------------------
-- Dispatchers: mobile number (fallback ring), weekly on-duty schedule, presence
-- ---------------------------------------------------------------------------------------------
alter table public.staff_members add column mobile_phone public.us_phone;

create table public.dispatcher_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_members (user_id) on delete cascade,
  -- 0 = Sunday ... 6 = Saturday, minutes after midnight in the dispatcher's time zone.
  weekday smallint not null check (weekday between 0 and 6),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  time_zone text not null default 'America/Chicago',
  check (end_minute > start_minute)
);
create index dispatcher_shifts_user_idx on public.dispatcher_shifts (user_id, weekday);
alter table public.dispatcher_shifts enable row level security;
create policy "staff read shifts" on public.dispatcher_shifts for select to authenticated
  using (public.jwt_staff_role() is not null);
create policy "managers edit shifts" on public.dispatcher_shifts for all to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager'));

create type public.dispatcher_presence as enum ('available', 'busy', 'away');
create table public.dispatcher_status (
  user_id uuid primary key references public.staff_members (user_id) on delete cascade,
  presence public.dispatcher_presence not null default 'away',
  -- "I am on duty now" toggle: on duty regardless of the schedule until switched off.
  on_duty_now boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.dispatcher_status enable row level security;
create policy "staff read dispatcher status" on public.dispatcher_status for select to authenticated
  using (public.jwt_staff_role() is not null);
create policy "dispatchers set their own status" on public.dispatcher_status for insert to authenticated
  with check (user_id = auth.uid() and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher'));
create policy "dispatchers update their own status" on public.dispatcher_status for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Dispatchers on duty now (toggle on, or inside a shift), with presence and mobile number.
create function public.on_duty_dispatchers(p_at timestamptz default now())
returns table (user_id uuid, presence public.dispatcher_presence, mobile_phone text)
language sql stable security definer set search_path = '' as $$
  select s.user_id, coalesce(d.presence, 'away'), s.mobile_phone::text
  from public.staff_members s
  left join public.dispatcher_status d on d.user_id = s.user_id
  where s.is_active and s.role in ('super_admin', 'ops_manager', 'dispatcher')
    and (coalesce(d.on_duty_now, false)
         or exists (select 1 from public.dispatcher_shifts f
                    where f.user_id = s.user_id
                      and f.weekday = extract(dow from (p_at at time zone f.time_zone))::int
                      and (extract(hour from (p_at at time zone f.time_zone)) * 60
                           + extract(minute from (p_at at time zone f.time_zone))) >= f.start_minute
                      and (extract(hour from (p_at at time zone f.time_zone)) * 60
                           + extract(minute from (p_at at time zone f.time_zone))) < f.end_minute));
$$;
revoke all on function public.on_duty_dispatchers(timestamptz) from public, anon;
grant execute on function public.on_duty_dispatchers(timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Location links (/l/<token>, RSOS-023)
-- ---------------------------------------------------------------------------------------------
create table public.location_links (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{22,64}$'),
  request_id uuid not null references public.requests (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '2 hours',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index location_links_request_idx on public.location_links (request_id);
alter table public.location_links enable row level security;
create policy "staff read location links" on public.location_links for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and public.staff_can_access_market(r.market_id)));

-- ---------------------------------------------------------------------------------------------
-- Texts and opt-outs (RSOS-035 adds templates, quiet hours and delivery reporting)
-- ---------------------------------------------------------------------------------------------
create type public.message_direction as enum ('outbound', 'inbound');
create type public.sms_status as enum ('queued', 'held', 'blocked', 'sent', 'delivered', 'undelivered', 'failed', 'received');
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  twilio_sid text unique check (twilio_sid ~ '^(SM|MM)[0-9a-fA-F]{32}$'),
  market_id uuid not null references public.markets (id) on delete restrict,
  request_id uuid references public.requests (id) on delete set null,
  direction public.message_direction not null,
  from_phone text not null,
  to_phone text not null,
  body text not null check (length(body) between 1 and 1600),
  template_key text,
  urgent boolean not null default false,
  status public.sms_status not null default 'queued',
  -- Why a text was held or blocked (opted out, quiet hours, registration pending...).
  status_reason text,
  error_code integer,
  segments smallint,
  staff_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  status_at timestamptz not null default now()
);
create index sms_messages_request_idx on public.sms_messages (request_id, created_at);
create index sms_messages_market_idx on public.sms_messages (market_id, created_at desc);
alter table public.sms_messages enable row level security;
create policy "staff read texts in their markets" on public.sms_messages for select to authenticated
  using (public.staff_can_access_market(market_id));

create table public.sms_opt_outs (
  phone public.us_phone primary key,
  opted_out boolean not null,
  -- The keyword or action that set it (STOP, START, admin...).
  source text not null check (length(source) between 1 and 40),
  updated_at timestamptz not null default now()
);
alter table public.sms_opt_outs enable row level security;
create policy "staff read opt-outs" on public.sms_opt_outs for select to authenticated
  using (public.jwt_staff_role() is not null);

-- ---------------------------------------------------------------------------------------------
-- Webhook idempotency: one row per vendor event; a repeat delivery is a no-op.
-- ---------------------------------------------------------------------------------------------
create table public.webhook_events (
  vendor text not null check (vendor ~ '^[a-z]{2,20}$'),
  event_key text not null check (length(event_key) between 3 and 200),
  received_at timestamptz not null default now(),
  primary key (vendor, event_key)
);
alter table public.webhook_events enable row level security;
-- No policies: only the service role (webhook handlers) reads and writes it.

-- Realtime for the admin inbox (RSOS-034b).
alter publication supabase_realtime add table public.calls, public.sms_messages;
