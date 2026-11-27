-- RSOS-117: simple booking commitment, live tracking and proof of service.
--
-- * The provider fee is RESERVED when the customer picks (or a dispatcher assigns) and CHARGED on
--   the first proof: the completion code, a GPS arrival, the customer's "Yes, fixed", or 60
--   minutes with no valid cancellation. It is RELEASED when the customer cancels before arrival,
--   the provider cancels, or an approved no-show. This replaces "charged at pick" (RSOS-038).
--   Reserving takes the money out of the wallet (bonus credit first, then paid balance) so it is
--   not spendable; releasing returns it the way refund_job_fee does.
-- * The customer booking fee (default 5 USD) is OFF in every market by default. Only the Owner
--   turns it on. It is paid through the fake billing adapter until Stripe (batch 6).
-- * A 4-digit completion code per booking, shown only to the customer; 5 wrong tries lock it.
-- * Every step stores time and GPS; automatic warning flags; a weekly 5% spot check queue.
-- * Customer reliability: 2 no-shows in 90 days make the booking fee required, 3 block booking.

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------
create table public.booking_fee_settings (
  market_id uuid primary key references public.markets (id) on delete cascade,
  enabled boolean not null default false,
  amount_cents integer not null default 500 check (amount_cents between 0 and 5000),
  free_cancel_seconds integer not null default 120 check (free_cancel_seconds between 0 and 1800),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.booking_fee_settings enable row level security;
revoke all on public.booking_fee_settings from anon, authenticated;
grant select on public.booking_fee_settings to authenticated;
create policy "staff read booking fee settings in their markets" on public.booking_fee_settings
  for select to authenticated using (public.staff_can_access_market(market_id));

-- One row of platform-wide rules (all admin-editable).
create table public.booking_rules (
  id boolean primary key default true check (id),
  charge_after_minutes integer not null default 60 check (charge_after_minutes between 10 and 600),
  late_refund_minutes integer not null default 30 check (late_refund_minutes between 5 and 240),
  backup_after_minutes integer not null default 15 check (backup_after_minutes between 5 and 120),
  arrival_radius_m integer not null default 200 check (arrival_radius_m between 50 and 2000),
  code_max_tries integer not null default 5 check (code_max_tries between 3 and 10),
  no_show_wait_minutes integer not null default 15 check (no_show_wait_minutes between 5 and 60),
  no_show_release_limit integer not null default 3 check (no_show_release_limit between 0 and 30),
  short_job_minutes integer not null default 5 check (short_job_minutes between 1 and 60),
  spot_check_pct numeric(5, 2) not null default 5 check (spot_check_pct between 0 and 100),
  fee_after_no_shows integer not null default 2 check (fee_after_no_shows between 1 and 10),
  block_after_no_shows integer not null default 3 check (block_after_no_shows between 1 and 10),
  reliability_days integer not null default 90 check (reliability_days between 7 and 365),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (block_after_no_shows > fee_after_no_shows)
);
insert into public.booking_rules default values;
alter table public.booking_rules enable row level security;
revoke all on public.booking_rules from anon, authenticated;
grant select on public.booking_rules to authenticated;
create policy "staff read booking rules" on public.booking_rules for select to authenticated
  using (public.jwt_staff_role() is not null);

-- ---------------------------------------------------------------------------------------------
-- Bookings, codes, holds, events, payments
-- ---------------------------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  provider_id uuid not null references public.providers (id) on delete restrict,
  source text not null check (source in ('customer', 'dispatcher')),
  price_cents integer not null check (price_cents between 0 and 1000000),
  promised_at timestamptz not null,
  picked_at timestamptz not null default now(),
  status text not null default 'booked'
    check (status in ('booked', 'en_route', 'on_site', 'done', 'cancelled', 'replaced')),
  booking_fee_cents integer not null default 0 check (booking_fee_cents >= 0),
  booking_fee_status text not null default 'none' check (booking_fee_status in ('none', 'paid', 'refunded', 'kept')),
  free_cancel_until timestamptz not null,
  -- Hashes for reliability and the same-device check (never the raw phone or device id).
  customer_key text,
  customer_device text,
  provider_device text,
  en_route_at timestamptz,
  arrived_at timestamptz,
  arrived_lat double precision,
  arrived_lng double precision,
  done_at timestamptz,
  done_by text check (done_by in ('code', 'not_available', 'staff')),
  not_available_photos integer check (not_available_photos between 0 and 10),
  provider_report text check (provider_report in ('customer_cancelled', 'no_show')),
  provider_report_at timestamptz,
  no_show_decided_at timestamptz,
  customer_answer text check (customer_answer in ('fixed', 'not_fixed')),
  customer_answered_at timestamptz,
  rating smallint check (rating between 1 and 5),
  dispute_note text check (length(dispute_note) <= 1000),
  cancelled_by text check (cancelled_by in ('customer', 'provider', 'staff')),
  cancelled_at timestamptz,
  backup_requested_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index bookings_one_active on public.bookings (request_id)
  where status not in ('cancelled', 'replaced');
create index bookings_provider_idx on public.bookings (provider_id, created_at desc);
create index bookings_market_idx on public.bookings (market_id, created_at desc);
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
create policy "staff read bookings in their markets" on public.bookings for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "providers read their own bookings" on public.bookings for select to authenticated
  using (public.jwt_provider_role(provider_id) is not null);

-- The completion code: no policies at all (default deny). Only the definer functions below read
-- it, and only the customer (by the request's status token) is ever shown it.
create table public.booking_codes (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  tries integer not null default 0,
  locked_at timestamptz
);
alter table public.booking_codes enable row level security;
revoke all on public.booking_codes from anon, authenticated;

-- The provider fee for a job: held at pick, then charged or released (once).
create table public.fee_holds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete restrict,
  market_id uuid not null references public.markets (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'held' check (status in ('held', 'charged', 'released', 'review')),
  reason text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create unique index fee_holds_one_per_job on public.fee_holds (request_id, provider_id);
create index fee_holds_held_idx on public.fee_holds (created_at) where status = 'held';
alter table public.fee_holds enable row level security;
revoke all on public.fee_holds from anon, authenticated;
grant select on public.fee_holds to authenticated;
create policy "staff read holds in their markets" on public.fee_holds for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "providers read their own holds" on public.fee_holds for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor text not null check (actor in ('customer', 'provider', 'staff', 'system')),
  kind text not null,
  lat double precision,
  lng double precision,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);
create trigger booking_events_append_only before update or delete on public.booking_events
  for each row execute function public.forbid_change();
alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;
create policy "staff read booking events" on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and public.staff_can_access_market(b.market_id)));

-- Customer booking fee payments and refunds (fake adapter until Stripe, batch 6). Append-only.
create table public.booking_payments (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  kind text not null check (kind in ('charge', 'refund')),
  amount_cents integer not null check (amount_cents > 0),
  adapter text not null default 'fake' check (adapter in ('fake', 'stripe')),
  reason text not null,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index booking_payments_one_each on public.booking_payments (booking_id, kind);
create trigger booking_payments_append_only before update or delete on public.booking_payments
  for each row execute function public.forbid_change();
alter table public.booking_payments enable row level security;
revoke all on public.booking_payments from anon, authenticated;
grant select on public.booking_payments to authenticated;
create policy "finance and operations read booking payments" on public.booking_payments for select to authenticated
  using (public.staff_role_in('super_admin', 'ops_manager', 'finance') and public.staff_can_access_market(market_id));

-- Warning signs for the admin (Inbox > Job checks and the provider profile).
create table public.booking_flags (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  kind text not null check (kind in ('done_without_arrival', 'short_job', 'high_cancel_rate', 'high_no_show_rate',
    'same_device', 'many_not_available', 'code_locked', 'cancel_then_fixed', 'customer_dispute', 'no_show_review')),
  status text not null default 'open' check (status in ('open', 'cleared')),
  note text check (length(note) <= 500),
  cleared_by uuid references auth.users (id) on delete set null,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index booking_flags_one_each on public.booking_flags (booking_id, kind);
create index booking_flags_open_idx on public.booking_flags (market_id, created_at) where status = 'open';
create index booking_flags_provider_idx on public.booking_flags (provider_id, created_at desc);
alter table public.booking_flags enable row level security;
revoke all on public.booking_flags from anon, authenticated;
grant select on public.booking_flags to authenticated;
create policy "staff read booking flags in their markets" on public.booking_flags for select to authenticated
  using (public.staff_can_access_market(market_id));

create table public.customer_reliability (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id) on delete restrict,
  customer_key text,
  device_key text,
  booking_id uuid references public.bookings (id) on delete set null,
  kind text not null check (kind in ('no_show', 'late_cancel')),
  created_at timestamptz not null default now(),
  check (customer_key is not null or device_key is not null)
);
create index customer_reliability_customer_idx on public.customer_reliability (customer_key, created_at desc);
create index customer_reliability_device_idx on public.customer_reliability (device_key, created_at desc);
alter table public.customer_reliability enable row level security;
revoke all on public.customer_reliability from anon, authenticated;
grant select on public.customer_reliability to authenticated;
create policy "staff read reliability in their markets" on public.customer_reliability for select to authenticated
  using (public.staff_can_access_market(market_id));

create table public.spot_checks (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  week date not null,
  status text not null default 'open' check (status in ('open', 'confirmed', 'problem')),
  note text check (length(note) <= 500),
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.spot_checks enable row level security;
revoke all on public.spot_checks from anon, authenticated;
grant select on public.spot_checks to authenticated;
create policy "staff read spot checks in their markets" on public.spot_checks for select to authenticated
  using (public.staff_can_access_market(market_id));

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create function public.booking_rule() returns public.booking_rules
language sql stable security definer set search_path = '' as $$
  select * from public.booking_rules where id
$$;
revoke all on function public.booking_rule() from public, anon, authenticated;

create function public.customer_key_for(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select case when p_phone is null or length(regexp_replace(p_phone, '\D', '', 'g')) < 10 then null
              else public.sha256_hex('customer:' || right(regexp_replace(p_phone, '\D', '', 'g'), 10)) end
$$;
revoke all on function public.customer_key_for(text) from public, anon, authenticated;

-- The booking fee in a market: on or off, amount, free cancel window (public: shown on quotes).
create function public.booking_fee_for(p_market_id uuid)
returns table (enabled boolean, amount_cents integer, free_cancel_seconds integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(s.enabled, false), coalesce(s.amount_cents, 500), coalesce(s.free_cancel_seconds, 120)
    from (select p_market_id as id) m
    left join public.booking_fee_settings s on s.market_id = m.id
$$;
grant execute on function public.booking_fee_for(uuid) to anon, authenticated;

create function public.public_booking_fee(p_market_slug text)
returns table (enabled boolean, amount_cents integer, free_cancel_seconds integer)
language sql stable security definer set search_path = '' as $$
  select f.* from public.markets m, lateral public.booking_fee_for(m.id) f where m.slug = p_market_slug
$$;
grant execute on function public.public_booking_fee(text) to anon, authenticated;

-- 'ok', 'fee_required' (2 no-shows in 90 days) or 'blocked' (3 or more), by phone hash or device.
create function public.customer_standing(p_customer_key text, p_device_key text)
returns text
language sql stable security definer set search_path = '' as $$
  with r as (select * from public.booking_rule()),
  n as (
    select count(*) as c from public.customer_reliability x, r
     where x.kind = 'no_show' and x.created_at > now() - make_interval(days => r.reliability_days)
       and ((p_customer_key is not null and x.customer_key = p_customer_key)
         or (p_device_key is not null and x.device_key = p_device_key))
  )
  select case when n.c >= r.block_after_no_shows then 'blocked'
              when n.c >= r.fee_after_no_shows then 'fee_required' else 'ok' end
    from n, r
$$;
revoke all on function public.customer_standing(text, text) from public, anon, authenticated;

create function public.booking_event(p_booking uuid, p_actor text, p_kind text, p_lat double precision,
                                     p_lng double precision, p_data jsonb default '{}')
returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.booking_events (booking_id, actor, kind, lat, lng, data)
  values (p_booking, p_actor, p_kind, p_lat, p_lng, coalesce(p_data, '{}'));
$$;
revoke all on function public.booking_event(uuid, text, text, double precision, double precision, jsonb) from public, anon, authenticated;

create function public.raise_booking_flag(p_booking uuid, p_kind text, p_note text default null)
returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.booking_flags (booking_id, provider_id, market_id, kind, note)
  select b.id, b.provider_id, b.market_id, p_kind, p_note from public.bookings b where b.id = p_booking
  on conflict (booking_id, kind) do nothing;
$$;
revoke all on function public.raise_booking_flag(uuid, text, text) from public, anon, authenticated;

-- Reserve the provider fee: the money leaves the wallet (bonus credit first) and is held.
create function public.reserve_job_fee(p_provider_id uuid, p_amount_cents integer, p_request_id uuid, p_booking uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_market uuid;
begin
  if exists (select 1 from public.fee_holds h where h.request_id = p_request_id and h.provider_id = p_provider_id) then
    update public.fee_holds set booking_id = coalesce(booking_id, p_booking)
     where request_id = p_request_id and provider_id = p_provider_id;
    return;
  end if;
  select r.market_id into v_market from public.requests r where r.id = p_request_id;
  insert into public.fee_holds (request_id, provider_id, market_id, booking_id, amount_cents)
  values (p_request_id, p_provider_id, v_market, p_booking, greatest(0, p_amount_cents));
  if p_amount_cents > 0 then
    perform public.charge_wallet(p_provider_id, p_amount_cents, p_request_id, 'fee');
  end if;
end;
$$;
revoke all on function public.reserve_job_fee(uuid, integer, uuid, uuid) from public, anon, authenticated;

-- Give a held fee back: credit returns as bonus credit (original expiry or 14 days, whichever is
-- later), the paid part to the paid balance. Same rules as refund_job_fee.
create function public.return_held_fee(p_hold public.fee_holds, p_reason text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  u record;
  v_paid integer;
begin
  for u in
    select l.grant_id, -l.amount_cents as cents, b.expires_at
      from public.wallet_ledger l join public.bonus_grants b on b.id = l.grant_id
     where l.request_id = p_hold.request_id and l.provider_id = p_hold.provider_id and l.kind = 'bonus_use'
       and l.created_at >= p_hold.created_at - interval '1 second'
  loop
    perform public.create_bonus_grant(p_hold.provider_id, 'refund', u.cents,
      greatest(u.expires_at, now() + interval '14 days'), null, p_reason, null, false, u.grant_id);
  end loop;
  select -coalesce(sum(l.amount_cents), 0)::int into v_paid from public.wallet_ledger l
   where l.request_id = p_hold.request_id and l.provider_id = p_hold.provider_id and l.kind = 'fee'
     and l.created_at >= p_hold.created_at - interval '1 second';
  v_paid := least(v_paid, p_hold.amount_cents);
  if v_paid > 0 then
    update public.provider_wallets set balance_cents = balance_cents + v_paid, updated_at = now()
     where provider_id = p_hold.provider_id;
    insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, request_id, note)
    values (p_hold.provider_id, p_hold.market_id, 'fee_refund', 'paid', v_paid, p_hold.request_id, p_reason);
  end if;
end;
$$;
revoke all on function public.return_held_fee(public.fee_holds, text) from public, anon, authenticated;

-- Charge, release or send to review a held fee. Only a held (or review) fee changes.
create function public.settle_fee_hold(p_request_id uuid, p_provider_id uuid, p_action text, p_reason text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  h public.fee_holds%rowtype;
begin
  select * into h from public.fee_holds where request_id = p_request_id and provider_id = p_provider_id for update;
  if h.id is null or h.status not in ('held', 'review') then return coalesce(h.status, 'none'); end if;
  if p_action = 'charge' then
    update public.fee_holds set status = 'charged', reason = p_reason, settled_at = now() where id = h.id;
  elsif p_action = 'release' then
    perform public.return_held_fee(h, p_reason);
    update public.fee_holds set status = 'released', reason = p_reason, settled_at = now() where id = h.id;
  elsif p_action = 'review' then
    update public.fee_holds set status = 'review', reason = p_reason where id = h.id;
  else
    raise exception 'invalid action' using errcode = '22023';
  end if;
  perform public.wallet_audit('wallet.fee_' || p_action, 'request', p_request_id::text, h.market_id,
    jsonb_build_object('provider_id', p_provider_id, 'amount_cents', h.amount_cents, 'reason', p_reason));
  return case p_action when 'charge' then 'charged' when 'release' then 'released' else 'review' end;
end;
$$;
revoke all on function public.settle_fee_hold(uuid, uuid, text, text) from public, anon, authenticated;

create function public.booking_fee_refund(p_booking uuid, p_reason text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or b.booking_fee_status <> 'paid' then return false; end if;
  insert into public.booking_payments (booking_id, market_id, kind, amount_cents, reason, is_test)
  values (b.id, b.market_id, 'refund', b.booking_fee_cents, p_reason, b.is_test);
  update public.bookings set booking_fee_status = 'refunded' where id = b.id;
  perform public.booking_event(b.id, 'system', 'booking_fee_refunded', null, null, jsonb_build_object('reason', p_reason));
  return true;
end;
$$;
revoke all on function public.booking_fee_refund(uuid, text) from public, anon, authenticated;

create function public.set_request_stage(p_request_id uuid, p_status public.request_status, p_actor public.actor_type, p_data jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_from public.request_status;
begin
  select status into v_from from public.requests where id = p_request_id for update;
  if v_from is null or v_from = p_status then return; end if;
  update public.requests set
    status = p_status,
    accepted_at = case when p_status = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
    en_route_at = case when p_status = 'en_route' then now() else en_route_at end,
    on_site_at = case when p_status = 'on_site' then now() else on_site_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = p_request_id;
  insert into public.request_events (request_id, event_type, from_status, to_status, actor_type, data)
  values (p_request_id, 'status', v_from, p_status, p_actor, coalesce(p_data, '{}'));
end;
$$;
revoke all on function public.set_request_stage(uuid, public.request_status, public.actor_type, jsonb) from public, anon, authenticated;

-- The pick: create the booking, reserve the provider fee (Pro discount applied), take the
-- customer booking fee when it applies, and make the completion code.
create function public.create_booking(p_request_id uuid, p_provider_id uuid, p_price_cents integer,
                                      p_eta_minutes integer, p_source text, p_device text, p_pay boolean)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.requests%rowtype;
  f record;
  v_fee integer;
  v_key text;
  v_standing text;
  v_booking_fee integer := 0;
  v_id uuid;
begin
  select * into r from public.requests where id = p_request_id for update;
  if r.id is null then raise exception 'request not found' using errcode = '22023'; end if;
  if r.status in ('completed', 'cancelled', 'expired', 'no_provider') then
    raise exception 'this request is closed' using errcode = '22023';
  end if;
  if exists (select 1 from public.bookings b where b.request_id = r.id and b.status not in ('cancelled', 'replaced')) then
    raise exception 'already booked' using errcode = '22023';
  end if;
  if not exists (select 1 from public.providers p where p.id = p_provider_id and p.status = 'active'
                   and r.market_id = any (p.market_ids)) then
    raise exception 'this provider cannot take the job' using errcode = '22023';
  end if;
  v_key := public.customer_key_for(r.driver_phone::text);
  v_standing := public.customer_standing(v_key, p_device);
  if p_source = 'customer' then
    if v_standing = 'blocked' then
      raise exception 'booking blocked: contact support' using errcode = '42501';
    end if;
    select * into f from public.booking_fee_for(r.market_id);
    if f.enabled or v_standing = 'fee_required' then
      if not coalesce(p_pay, false) then
        raise exception 'booking fee required' using errcode = '22023';
      end if;
      v_booking_fee := f.amount_cents;
    end if;
  else
    select * into f from public.booking_fee_for(r.market_id);
  end if;

  insert into public.bookings (request_id, market_id, provider_id, source, price_cents, promised_at,
                               booking_fee_cents, booking_fee_status, free_cancel_until, customer_key,
                               customer_device, is_test)
  values (r.id, r.market_id, p_provider_id, p_source, greatest(0, coalesce(p_price_cents, 0)),
          now() + make_interval(mins => greatest(1, coalesce(p_eta_minutes, 30))),
          v_booking_fee, case when v_booking_fee > 0 then 'paid' else 'none' end,
          now() + make_interval(secs => f.free_cancel_seconds), v_key, p_device, coalesce(r.is_test, false))
  returning id into v_id;
  insert into public.booking_codes (booking_id, code)
  values (v_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
  if v_booking_fee > 0 then
    insert into public.booking_payments (booking_id, market_id, kind, amount_cents, reason, is_test)
    values (v_id, r.market_id, 'charge', v_booking_fee, 'booking fee', coalesce(r.is_test, false));
  end if;

  select coalesce(cms.platform_fee_cents, r.platform_fee_cents, 0) into v_fee
    from (select 1) x left join public.current_market_services cms
      on cms.market_id = r.market_id and cms.service_id = r.service_id;
  v_fee := round(coalesce(v_fee, 0) * (10000 - public.provider_fee_discount_bps(p_provider_id)) / 10000.0)::int;
  perform public.reserve_job_fee(p_provider_id, v_fee, r.id, v_id);
  perform public.booking_event(v_id, case when p_source = 'customer' then 'customer' else 'staff' end, 'booked', null, null,
    jsonb_build_object('price_cents', p_price_cents, 'eta_minutes', p_eta_minutes, 'booking_fee_cents', v_booking_fee,
                       'fee_cents', v_fee));
  return v_id;
end;
$$;
revoke all on function public.create_booking(uuid, uuid, integer, integer, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Customer (by the request's status token; no account)
-- ---------------------------------------------------------------------------------------------
create function public.book_request_by_token(p_token text, p_provider_id uuid, p_price_cents integer,
                                             p_eta_minutes integer, p_device text default null, p_pay boolean default false)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_request uuid;
  v_id uuid;
begin
  select id into v_request from public.requests where status_token = p_token and length(p_token) >= 24;
  if v_request is null then raise exception 'request not found' using errcode = '22023'; end if;
  v_id := public.create_booking(v_request, p_provider_id, p_price_cents, p_eta_minutes, 'customer',
                                nullif(left(coalesce(p_device, ''), 128), ''), p_pay);
  update public.requests set assigned_provider_id = p_provider_id, quoted_price_cents = p_price_cents,
                             quoted_eta_minutes = p_eta_minutes
   where id = v_request;
  perform public.set_request_stage(v_request, 'accepted', 'driver', jsonb_build_object('provider_id', p_provider_id));
  return v_id;
end;
$$;
revoke all on function public.book_request_by_token(text, uuid, integer, integer, text, boolean) from public;
grant execute on function public.book_request_by_token(text, uuid, integer, integer, text, boolean) to anon, authenticated;

-- What the customer's tracking page shows: provider, locked price, promised arrival, stage, the
-- completion code, the booking fee and whether the backup button or the confirmation applies.
create function public.booking_for_token(p_token text)
returns table (booking_id uuid, provider_name text, price_cents integer, promised_at timestamptz,
               status text, code text, booking_fee_cents integer, booking_fee_status text,
               free_cancel_until timestamptz, can_request_backup boolean, needs_answer boolean,
               customer_answer text, rating smallint)
language sql stable security definer set search_path = '' as $$
  select b.id, p.name, b.price_cents, b.promised_at, b.status,
         case when b.status in ('booked', 'en_route', 'on_site') then c.code end,
         b.booking_fee_cents, b.booking_fee_status, b.free_cancel_until,
         b.status in ('booked', 'en_route') and b.arrived_at is null
           and now() > b.promised_at + make_interval(mins => (select backup_after_minutes from public.booking_rule())),
         (b.status = 'done' or b.provider_report = 'customer_cancelled') and b.customer_answer is null,
         b.customer_answer, b.rating
    from public.requests r
    join public.bookings b on b.request_id = r.id
    join public.providers p on p.id = b.provider_id
    left join public.booking_codes c on c.booking_id = b.id
   where r.status_token = p_token and length(p_token) >= 24
   order by (b.status not in ('cancelled', 'replaced')) desc, b.created_at desc
   limit 1
$$;
grant execute on function public.booking_for_token(text) to anon, authenticated;

-- The customer cancels. Before arrival the provider fee is released. The booking fee comes back
-- inside the free cancel window; after it, the fee is kept and it counts as a late cancel.
create function public.customer_cancel_booking(p_request_id uuid)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
  v_out text := 'none';
begin
  select * into b from public.bookings where request_id = p_request_id and status in ('booked', 'en_route')
   for update;
  if b.id is null then return 'none'; end if;
  update public.bookings set status = 'cancelled', cancelled_by = 'customer', cancelled_at = now() where id = b.id;
  perform public.settle_fee_hold(b.request_id, b.provider_id, 'release', 'customer cancelled before arrival');
  perform public.booking_event(b.id, 'customer', 'cancelled', null, null, '{}');
  if now() <= b.free_cancel_until then
    if public.booking_fee_refund(b.id, 'free cancel window') then v_out := 'refunded'; end if;
  else
    if b.booking_fee_status = 'paid' then
      update public.bookings set booking_fee_status = 'kept' where id = b.id;
      v_out := 'kept';
    end if;
    insert into public.customer_reliability (market_id, customer_key, device_key, booking_id, kind)
    select b.market_id, b.customer_key, b.customer_device, b.id, 'late_cancel'
     where b.customer_key is not null or b.customer_device is not null;
  end if;
  return v_out;
end;
$$;
revoke all on function public.customer_cancel_booking(uuid) from public, anon, authenticated;

create or replace function public.cancel_request_by_token(p_token text, p_reason text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare r public.requests%rowtype;
begin
  if p_reason not in ('found_help', 'too_slow', 'too_expensive', 'fixed', 'other') then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  select * into r from public.requests where status_token = p_token and length(p_token) >= 24 for update;
  if r.id is null or r.status in ('on_site', 'completed', 'cancelled', 'expired') then return false; end if;
  perform public.customer_cancel_booking(r.id);
  update public.requests set status = 'cancelled', cancelled_at = now() where id = r.id;
  insert into public.request_events (request_id, event_type, from_status, to_status, actor_type, data)
  values (r.id, 'cancelled', r.status, 'cancelled', 'driver', jsonb_build_object('reason', p_reason));
  return true;
end;
$$;

-- "Yes, fixed" or "No" (once), with an optional rating. "No" opens a dispute for support.
create function public.answer_booking(p_token text, p_fixed boolean, p_rating integer default null, p_note text default null)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
  h public.fee_holds%rowtype;
begin
  select bk.* into b from public.bookings bk join public.requests r on r.id = bk.request_id
   where r.status_token = p_token and length(p_token) >= 24
     and (bk.status = 'done' or bk.provider_report = 'customer_cancelled') and bk.customer_answer is null
   order by bk.created_at desc limit 1 for update of bk;
  if b.id is null then return false; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'rating is 1 to 5' using errcode = '22023';
  end if;
  update public.bookings set customer_answer = case when p_fixed then 'fixed' else 'not_fixed' end,
         customer_answered_at = now(), rating = p_rating::smallint,
         dispute_note = case when p_fixed then null else nullif(left(trim(coalesce(p_note, '')), 1000), '') end
   where id = b.id;
  perform public.booking_event(b.id, 'customer', case when p_fixed then 'fixed' else 'not_fixed' end, null, null,
                               jsonb_build_object('rating', p_rating));
  if p_fixed then
    select * into h from public.fee_holds where request_id = b.request_id and provider_id = b.provider_id for update;
    if b.provider_report = 'customer_cancelled' and h.status = 'released' then
      -- The provider said the customer cancelled, but the customer says the job was done.
      perform public.charge_wallet(b.provider_id, h.amount_cents, b.request_id, 'fee');
      update public.fee_holds set status = 'charged', reason = 'customer confirmed the job', settled_at = now()
       where id = h.id;
      perform public.raise_booking_flag(b.id, 'cancel_then_fixed');
    else
      perform public.settle_fee_hold(b.request_id, b.provider_id, 'charge', 'customer confirmed the job');
    end if;
  else
    perform public.raise_booking_flag(b.id, 'customer_dispute', left(p_note, 500));
  end if;
  return true;
end;
$$;
revoke all on function public.answer_booking(text, boolean, integer, text) from public;
grant execute on function public.answer_booking(text, boolean, integer, text) to anon, authenticated;

-- "Find me another provider": 15 minutes past the promised arrival and not arrived. The late
-- provider's fee is released; the request goes back to quoting. The booking fee is refunded if
-- nobody new is booked in time (run_booking_timers).
create function public.request_backup(p_token text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
begin
  select bk.* into b from public.bookings bk join public.requests r on r.id = bk.request_id
   where r.status_token = p_token and length(p_token) >= 24 and bk.status in ('booked', 'en_route')
     and bk.arrived_at is null
     and now() > bk.promised_at + make_interval(mins => (select backup_after_minutes from public.booking_rule()))
   for update of bk;
  if b.id is null then return false; end if;
  update public.bookings set status = 'replaced', backup_requested_at = now() where id = b.id;
  perform public.settle_fee_hold(b.request_id, b.provider_id, 'release', 'provider late, customer asked for another');
  perform public.booking_event(b.id, 'customer', 'backup_requested', null, null, '{}');
  update public.requests set assigned_provider_id = null where id = b.request_id;
  perform public.set_request_stage(b.request_id, 'quoting', 'driver', jsonb_build_object('backup', true, 'priority', true));
  return true;
end;
$$;
revoke all on function public.request_backup(text) from public;
grant execute on function public.request_backup(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Provider: On my way, Arrived (GPS), Done (code, or "Customer not available" with 2 photos),
-- report a no-show or a customer cancellation, cancel.
-- ---------------------------------------------------------------------------------------------
create function public.provider_job_step(p_booking_id uuid, p_step text, p_lat double precision default null,
                                         p_lng double precision default null, p_code text default null,
                                         p_photos integer default 0, p_device text default null)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
  c public.booking_codes%rowtype;
  rules public.booking_rules;
  v_dist double precision;
  v_point extensions.geography;
  v_recent integer;
  v_cancels integer;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or (public.jwt_provider_role(b.provider_id) is null
                      and not public.staff_role_in('super_admin', 'ops_manager', 'dispatcher')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rules := public.booking_rule();
  if p_lat is not null and p_lng is not null then
    select extensions.st_distance(r.pickup_point,
             extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
      into v_dist from public.requests r where r.id = b.request_id;
  end if;
  if p_device is not null then
    update public.bookings set provider_device = left(p_device, 128) where id = b.id;
    b.provider_device := left(p_device, 128);
  end if;
  perform public.booking_event(b.id, 'provider', p_step, p_lat, p_lng,
                               jsonb_strip_nulls(jsonb_build_object('distance_m', round(v_dist::numeric))));

  if p_step = 'on_my_way' then
    if b.status <> 'booked' then return b.status; end if;
    update public.bookings set status = 'en_route', en_route_at = now() where id = b.id;
    perform public.set_request_stage(b.request_id, 'en_route', 'provider', '{}');
    return 'en_route';

  elsif p_step = 'arrived' then
    if b.status not in ('booked', 'en_route') then return b.status; end if;
    if v_dist is null or v_dist > rules.arrival_radius_m then
      raise exception 'not at the customer yet' using errcode = '22023';
    end if;
    update public.bookings set status = 'on_site', arrived_at = now(), arrived_lat = p_lat, arrived_lng = p_lng,
           en_route_at = coalesce(en_route_at, now())
     where id = b.id;
    perform public.settle_fee_hold(b.request_id, b.provider_id, 'charge', 'arrived (GPS)');
    perform public.set_request_stage(b.request_id, 'on_site', 'provider', '{}');
    return 'on_site';

  elsif p_step in ('done', 'not_available') then
    if b.status not in ('booked', 'en_route', 'on_site') then return b.status; end if;
    if p_step = 'done' then
      select * into c from public.booking_codes where booking_id = b.id for update;
      if c.locked_at is not null then return 'locked'; end if;
      if coalesce(p_code, '') <> c.code then
        update public.booking_codes set tries = tries + 1,
               locked_at = case when tries + 1 >= rules.code_max_tries then now() end
         where booking_id = b.id;
        if c.tries + 1 >= rules.code_max_tries then
          perform public.raise_booking_flag(b.id, 'code_locked');
          return 'locked';
        end if;
        return 'wrong_code';
      end if;
    elsif coalesce(p_photos, 0) < 2 then
      raise exception 'take 2 photos' using errcode = '22023';
    end if;
    update public.bookings set status = 'done', done_at = now(),
           done_by = case when p_step = 'done' then 'code' else 'not_available' end,
           not_available_photos = case when p_step = 'not_available' then p_photos end
     where id = b.id;
    perform public.settle_fee_hold(b.request_id, b.provider_id, 'charge',
                                   case when p_step = 'done' then 'completion code' else 'customer not available' end);
    perform public.set_request_stage(b.request_id, 'completed', 'provider', '{}');
    -- Warning signs.
    if b.arrived_at is null then perform public.raise_booking_flag(b.id, 'done_without_arrival'); end if;
    if b.arrived_at is not null and now() - b.arrived_at < make_interval(mins => rules.short_job_minutes) then
      perform public.raise_booking_flag(b.id, 'short_job');
    end if;
    if b.provider_device is not null and b.provider_device = b.customer_device then
      perform public.raise_booking_flag(b.id, 'same_device');
    end if;
    if p_step = 'not_available' then
      select count(*) into v_recent from public.bookings x
       where x.provider_id = b.provider_id and x.done_by = 'not_available' and x.done_at > now() - interval '30 days';
      if v_recent >= 3 then perform public.raise_booking_flag(b.id, 'many_not_available'); end if;
    end if;
    return 'done';

  elsif p_step in ('no_show', 'customer_cancelled') then
    if b.status not in ('booked', 'en_route', 'on_site') or b.provider_report is not null then return b.status; end if;
    update public.bookings set provider_report = p_step, provider_report_at = now() where id = b.id;
    if p_step = 'customer_cancelled' then
      update public.bookings set status = 'cancelled', cancelled_by = 'customer', cancelled_at = now() where id = b.id;
      perform public.settle_fee_hold(b.request_id, b.provider_id, 'release', 'provider reported the customer cancelled');
      perform public.set_request_stage(b.request_id, 'cancelled', 'provider', jsonb_build_object('reason', 'customer_cancelled'));
    else
      select count(*) into v_recent from public.bookings x
       where x.provider_id = b.provider_id and x.provider_report = 'no_show' and x.provider_report_at > now() - interval '30 days';
      if v_recent >= 3 then perform public.raise_booking_flag(b.id, 'high_no_show_rate'); end if;
    end if;
    return p_step;

  elsif p_step = 'cancel' then
    if b.status not in ('booked', 'en_route', 'on_site') then return b.status; end if;
    update public.bookings set status = 'cancelled', cancelled_by = 'provider', cancelled_at = now() where id = b.id;
    perform public.settle_fee_hold(b.request_id, b.provider_id, 'release', 'provider cancelled');
    perform public.booking_fee_refund(b.id, 'provider cancelled');
    update public.requests set assigned_provider_id = null where id = b.request_id;
    perform public.set_request_stage(b.request_id, 'quoting', 'provider', jsonb_build_object('reason', 'provider_cancelled'));
    select count(*) filter (where x.cancelled_by = 'provider') into v_cancels
      from (select * from public.bookings x where x.provider_id = b.provider_id order by x.created_at desc limit 10) x;
    if v_cancels >= 3 then perform public.raise_booking_flag(b.id, 'high_cancel_rate'); end if;
    return 'cancelled';
  end if;
  raise exception 'invalid step' using errcode = '22023';
end;
$$;
revoke all on function public.provider_job_step(uuid, text, double precision, double precision, text, integer, text) from public, anon;
grant execute on function public.provider_job_step(uuid, text, double precision, double precision, text, integer, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Dispatcher path (RSOS-038 changed): assigning books the job and reserves the fee.
-- ---------------------------------------------------------------------------------------------
create or replace function public.record_manual_test_fee(p_provider_id uuid, p_amount_cents integer, p_request_id uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fee integer;
  r public.requests%rowtype;
  v_booking uuid;
begin
  if not public.staff_role_in('super_admin', 'ops_manager', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.provider_billing_events b
              where b.request_id = p_request_id and b.provider_id = p_provider_id and b.kind = 'manual_test') then
    return;
  end if;
  v_fee := round(p_amount_cents * (10000 - public.provider_fee_discount_bps(p_provider_id)) / 10000.0)::int;
  insert into public.provider_billing_events (provider_id, kind, amount_cents, request_id)
  values (p_provider_id, 'manual_test', v_fee, p_request_id);
  select * into r from public.requests where id = p_request_id;
  select id into v_booking from public.bookings
   where request_id = p_request_id and status not in ('cancelled', 'replaced');
  if v_booking is null then
    insert into public.bookings (request_id, market_id, provider_id, source, price_cents, promised_at,
                                 free_cancel_until, customer_key, is_test)
    values (r.id, r.market_id, p_provider_id, 'dispatcher', coalesce(r.quoted_price_cents, 0),
            now() + make_interval(mins => greatest(1, coalesce(r.quoted_eta_minutes, 30))),
            now(), public.customer_key_for(r.driver_phone::text), coalesce(r.is_test, false))
    returning id into v_booking;
    insert into public.booking_codes (booking_id, code)
    values (v_booking, lpad((floor(random() * 10000))::int::text, 4, '0'));
    perform public.booking_event(v_booking, 'staff', 'booked', null, null,
                                 jsonb_build_object('fee_cents', v_fee, 'source', 'dispatcher'));
  end if;
  perform public.reserve_job_fee(p_provider_id, v_fee, p_request_id, v_booking);
end;
$$;

-- Staff moving a request forward or cancelling it settles the booking: on site or completed by
-- staff charges the fee (staff confirmed), cancelled releases it.
create function public.requests_booking_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into b from public.bookings where request_id = new.id and status not in ('cancelled', 'replaced');
  if b.id is null then return new; end if;
  if new.status = 'en_route' and b.status = 'booked' then
    update public.bookings set status = 'en_route', en_route_at = coalesce(en_route_at, now()) where id = b.id;
  elsif new.status = 'on_site' and b.status in ('booked', 'en_route') then
    update public.bookings set status = 'on_site', arrived_at = coalesce(arrived_at, now()) where id = b.id;
  elsif new.status = 'completed' and b.status <> 'done' then
    update public.bookings set status = 'done', done_at = now(), done_by = 'staff' where id = b.id;
    perform public.settle_fee_hold(b.request_id, b.provider_id, 'charge', 'completed by staff');
  elsif new.status = 'cancelled' then
    update public.bookings set status = 'cancelled', cancelled_by = coalesce(cancelled_by, 'staff'),
           cancelled_at = coalesce(cancelled_at, now())
     where id = b.id;
    perform public.settle_fee_hold(b.request_id, b.provider_id, 'release', 'request cancelled');
  end if;
  return new;
end;
$$;
revoke all on function public.requests_booking_sync() from public, anon, authenticated;
create trigger requests_booking_sync after update of status on public.requests
  for each row execute function public.requests_booking_sync();

-- ---------------------------------------------------------------------------------------------
-- Timers (every minute): 60-minute charge, no-show decisions, late refunds, backup refunds.
-- ---------------------------------------------------------------------------------------------
create function public.run_booking_timers(p_now timestamptz default now())
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  rules public.booking_rules := public.booking_rule();
  x record;
  v_n integer := 0;
  v_released integer;
begin
  -- 1. No valid cancellation within the hour: charge.
  for x in
    select h.request_id, h.provider_id from public.fee_holds h
      left join public.bookings b on b.id = h.booking_id
     where h.status = 'held' and h.created_at < p_now - make_interval(mins => rules.charge_after_minutes)
       and (b.id is null or (b.status not in ('cancelled', 'replaced')
                             and (b.provider_report is distinct from 'no_show' or b.no_show_decided_at is not null)))
  loop
    perform public.settle_fee_hold(x.request_id, x.provider_id, 'charge', 'no cancellation within the hour');
    v_n := v_n + 1;
  end loop;

  -- 2. Provider no-shows, 15 minutes after the report.
  for x in
    select b.* from public.bookings b
     where b.provider_report = 'no_show' and b.no_show_decided_at is null
       and b.provider_report_at < p_now - make_interval(mins => rules.no_show_wait_minutes)
  loop
    update public.bookings set no_show_decided_at = p_now, status = 'cancelled', cancelled_by = 'customer',
           cancelled_at = coalesce(cancelled_at, p_now)
     where id = x.id;
    if x.arrived_at is not null and x.customer_answered_at is null then
      select count(*) into v_released from public.fee_holds h join public.bookings bb on bb.id = h.booking_id
       where h.provider_id = x.provider_id and h.status = 'released' and bb.provider_report = 'no_show'
         and h.settled_at >= date_trunc('month', p_now);
      if v_released < rules.no_show_release_limit then
        perform public.settle_fee_hold(x.request_id, x.provider_id, 'release', 'customer no-show (GPS at location)');
      else
        perform public.settle_fee_hold(x.request_id, x.provider_id, 'review', 'no-show over the monthly limit');
        perform public.raise_booking_flag(x.id, 'no_show_review');
      end if;
      insert into public.customer_reliability (market_id, customer_key, device_key, booking_id, kind)
      select x.market_id, x.customer_key, x.customer_device, x.id, 'no_show'
       where x.customer_key is not null or x.customer_device is not null;
    else
      perform public.settle_fee_hold(x.request_id, x.provider_id, 'charge', 'no-show not confirmed');
    end if;
    v_n := v_n + 1;
  end loop;

  -- 3. The provider has not arrived 30 minutes after the promised time: refund the booking fee.
  for x in
    select b.id from public.bookings b
     where b.booking_fee_status = 'paid' and b.status in ('booked', 'en_route') and b.arrived_at is null
       and b.promised_at < p_now - make_interval(mins => rules.late_refund_minutes)
  loop
    perform public.booking_fee_refund(x.id, 'provider late');
    v_n := v_n + 1;
  end loop;

  -- 4. Backup asked for and nobody new booked within 30 minutes: refund the booking fee.
  for x in
    select b.id from public.bookings b
     where b.status = 'replaced' and b.booking_fee_status = 'paid'
       and b.backup_requested_at < p_now - make_interval(mins => rules.late_refund_minutes)
       and not exists (select 1 from public.bookings n where n.request_id = b.request_id
                         and n.created_at > b.backup_requested_at)
  loop
    perform public.booking_fee_refund(x.id, 'no other provider found');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.run_booking_timers(timestamptz) from public, anon, authenticated;

-- Spot checks: 5% of last week's finished jobs per market (at least one when there were any).
create function public.pick_spot_checks(p_now timestamptz default now())
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_week date := (date_trunc('week', p_now) - interval '7 days')::date;
  v_pct numeric := (select spot_check_pct from public.booking_rule());
  v_n integer;
begin
  if v_pct <= 0 then return 0; end if;
  with done as (
    select b.id, b.market_id, row_number() over (partition by b.market_id order by random()) as rn,
           count(*) over (partition by b.market_id) as total
      from public.bookings b
     where b.status = 'done' and not b.is_test
       and b.done_at >= v_week and b.done_at < v_week + 7
  ), ins as (
    insert into public.spot_checks (booking_id, market_id, week)
    select id, market_id, v_week from done where rn <= greatest(1, ceil(total * v_pct / 100.0))
    on conflict do nothing
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end;
$$;
revoke all on function public.pick_spot_checks(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'booking-timers') then
    perform cron.unschedule('booking-timers');
  end if;
  perform cron.schedule('booking-timers', '* * * * *', 'select public.run_booking_timers()');
  if exists (select 1 from cron.job where jobname = 'spot-checks') then
    perform cron.unschedule('spot-checks');
  end if;
  perform cron.schedule('spot-checks', '15 6 * * 1', 'select public.pick_spot_checks()');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------------------------
-- Booking fee per market. Owner and Operations manager edit; only the Owner can turn it on.
create function public.set_booking_fee(p_market_id uuid, p_enabled boolean, p_amount_cents integer,
                                       p_free_cancel_seconds integer)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_was boolean;
begin
  if not public.staff_role_in('super_admin', 'ops_manager') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select enabled into v_was from public.booking_fee_settings where market_id = p_market_id;
  if p_enabled and not coalesce(v_was, false) and not public.staff_role_in('super_admin') then
    raise exception 'only the owner can turn the booking fee on' using errcode = '42501';
  end if;
  insert into public.booking_fee_settings (market_id, enabled, amount_cents, free_cancel_seconds, updated_by, updated_at)
  values (p_market_id, p_enabled, p_amount_cents, p_free_cancel_seconds, auth.uid(), now())
  on conflict (market_id) do update set enabled = excluded.enabled, amount_cents = excluded.amount_cents,
    free_cancel_seconds = excluded.free_cancel_seconds, updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_log (actor_id, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), 'booking_fee.set', 'market', p_market_id::text, p_market_id,
          jsonb_build_object('enabled', p_enabled, 'amount_cents', p_amount_cents, 'free_cancel_seconds', p_free_cancel_seconds));
end;
$$;
revoke all on function public.set_booking_fee(uuid, boolean, integer, integer) from public, anon;
grant execute on function public.set_booking_fee(uuid, boolean, integer, integer) to authenticated;

create function public.set_booking_rules(p_charge_after integer, p_late_refund integer, p_backup_after integer,
                                         p_radius integer, p_no_show_limit integer, p_spot_pct numeric)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'ops_manager') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.booking_rules set charge_after_minutes = p_charge_after, late_refund_minutes = p_late_refund,
         backup_after_minutes = p_backup_after, arrival_radius_m = p_radius, no_show_release_limit = p_no_show_limit,
         spot_check_pct = p_spot_pct, updated_by = auth.uid(), updated_at = now()
   where id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'booking_rules.set', 'platform', 'booking_rules',
          jsonb_build_object('charge_after', p_charge_after, 'late_refund', p_late_refund, 'backup_after', p_backup_after,
                             'radius', p_radius, 'no_show_limit', p_no_show_limit, 'spot_pct', p_spot_pct));
end;
$$;
revoke all on function public.set_booking_rules(integer, integer, integer, integer, integer, numeric) from public, anon;
grant execute on function public.set_booking_rules(integer, integer, integer, integer, integer, numeric) to authenticated;

-- Clear a flag, or decide a held fee in review (no-shows over the limit).
create function public.clear_booking_flag(p_flag_id uuid, p_note text, p_release boolean default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare f public.booking_flags%rowtype; b public.bookings%rowtype;
begin
  select * into f from public.booking_flags where id = p_flag_id for update;
  if f.id is null or not public.staff_role_in('super_admin', 'ops_manager', 'dispatcher')
     or not public.staff_can_access_market(f.market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.booking_flags set status = 'cleared', cleared_by = auth.uid(), cleared_at = now(),
         note = coalesce(nullif(left(trim(coalesce(p_note, '')), 500), ''), note)
   where id = f.id;
  if p_release is not null then
    select * into b from public.bookings where id = f.booking_id;
    perform public.settle_fee_hold(b.request_id, b.provider_id, case when p_release then 'release' else 'charge' end,
                                   'reviewed by staff');
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), 'booking_flag.clear', 'booking', f.booking_id::text, f.market_id,
          jsonb_build_object('kind', f.kind, 'release', p_release));
end;
$$;
revoke all on function public.clear_booking_flag(uuid, text, boolean) from public, anon;
grant execute on function public.clear_booking_flag(uuid, text, boolean) to authenticated;

create function public.resolve_spot_check(p_booking_id uuid, p_ok boolean, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare s public.spot_checks%rowtype;
begin
  select * into s from public.spot_checks where booking_id = p_booking_id for update;
  if s.booking_id is null or not public.staff_role_in('super_admin', 'ops_manager', 'dispatcher')
     or not public.staff_can_access_market(s.market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.spot_checks set status = case when p_ok then 'confirmed' else 'problem' end,
         note = nullif(left(trim(coalesce(p_note, '')), 500), ''), checked_by = auth.uid(), checked_at = now()
   where booking_id = p_booking_id;
end;
$$;
revoke all on function public.resolve_spot_check(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_spot_check(uuid, boolean, text) to authenticated;

-- Support approves a complaint: the customer gets the booking fee back.
create function public.staff_refund_booking_fee(p_booking_id uuid, p_reason text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_market uuid;
begin
  select market_id into v_market from public.bookings where id = p_booking_id;
  if v_market is null or not public.staff_role_in('super_admin', 'ops_manager', 'dispatcher', 'finance')
     or not public.staff_can_access_market(v_market) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  return public.booking_fee_refund(p_booking_id, 'complaint approved: ' || trim(p_reason));
end;
$$;
revoke all on function public.staff_refund_booking_fee(uuid, text) from public, anon;
grant execute on function public.staff_refund_booking_fee(uuid, text) to authenticated;

-- Analytics and Finance: picked, paid booking fee, refunds and net revenue per market.
create function public.booking_fee_report(p_from timestamptz, p_to timestamptz)
returns table (market_id uuid, picked integer, paid integer, refunded integer, charged_cents bigint,
               refunded_cents bigint)
language sql stable security invoker set search_path = '' as $$
  select b.market_id,
         count(*)::int,
         count(*) filter (where b.booking_fee_cents > 0)::int,
         count(*) filter (where b.booking_fee_status = 'refunded')::int,
         coalesce((select sum(p.amount_cents) from public.booking_payments p join public.bookings x on x.id = p.booking_id
                    where x.market_id = b.market_id and p.kind = 'charge' and not p.is_test
                      and p.created_at >= p_from and p.created_at < p_to), 0)::bigint,
         coalesce((select sum(p.amount_cents) from public.booking_payments p join public.bookings x on x.id = p.booking_id
                    where x.market_id = b.market_id and p.kind = 'refund' and not p.is_test
                      and p.created_at >= p_from and p.created_at < p_to), 0)::bigint
    from public.bookings b
   where b.picked_at >= p_from and b.picked_at < p_to and not b.is_test and b.source = 'customer'
   group by b.market_id
$$;
revoke all on function public.booking_fee_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.booking_fee_report(timestamptz, timestamptz) to authenticated;

-- The wallet's held amount (shown as "Reserved" on the wallet).
create function public.held_fees(p_provider_id uuid)
returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(h.amount_cents), 0)::int from public.fee_holds h
   where h.provider_id = p_provider_id and h.status in ('held', 'review')
     and (public.jwt_provider_role(p_provider_id) in ('owner', 'manager')
          or public.staff_role_in('super_admin', 'ops_manager', 'finance'))
$$;
revoke all on function public.held_fees(uuid) from public, anon;
grant execute on function public.held_fees(uuid) to authenticated;
