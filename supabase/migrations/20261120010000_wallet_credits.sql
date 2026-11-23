-- RSOS-115: wallet bonus credits. Two balances: the paid balance (provider_wallets.balance_cents,
-- top-ups in batch 6) and bonus credit (grants that expire, are never cash and are spent first,
-- oldest expiry first). Every grant, use, expiry and reversal is a wallet_ledger row and an
-- audit_log row. No real money moves: job fees are taken from the ledger (fake billing).

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.credit_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 80),
  market_id uuid references public.markets (id) on delete set null,
  audience jsonb not null default '{}',
  amount_cents integer not null check (amount_cents between 100 and 100000),
  expiry_days integer not null default 60 check (expiry_days between 1 and 365),
  message text check (message is null or length(message) <= 300),
  budget_cents integer not null check (budget_cents > 0),
  granted_cents integer not null default 0 check (granted_cents >= 0),
  recipients integer not null default 0,
  plan_allowed boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (granted_cents <= budget_cents)
);

create table public.bonus_grants (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  market_id uuid references public.markets (id) on delete set null,
  source text not null check (source in ('signup', 'manual', 'campaign', 'milestone', 'referral', 'reactivation', 'refund')),
  reason text check (reason is null or reason in ('goodwill', 'dispute', 'promotion', 'test', 'other')),
  note text check (note is null or length(note) <= 300),
  amount_cents integer not null check (amount_cents > 0),
  remaining_cents integer not null check (remaining_cents >= 0),
  expires_at timestamptz not null,
  plan_allowed boolean not null default false,
  campaign_id uuid references public.credit_campaigns (id) on delete set null,
  refund_of uuid references public.bonus_grants (id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  expired_at timestamptz,
  check (remaining_cents <= amount_cents),
  check (source <> 'manual' or reason is not null),
  check (reason <> 'other' or length(trim(coalesce(note, ''))) >= 3)
);
create index bonus_grants_provider_idx on public.bonus_grants (provider_id, expires_at);
create unique index bonus_grants_one_signup on public.bonus_grants (provider_id) where source = 'signup';

create table public.wallet_ledger (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers (id) on delete cascade,
  market_id uuid references public.markets (id) on delete set null,
  kind text not null check (kind in ('topup', 'fee', 'fee_refund', 'bonus_grant', 'bonus_use', 'bonus_expiry', 'bonus_reversal', 'bonus_refund')),
  balance text not null check (balance in ('paid', 'bonus')),
  amount_cents integer not null,
  grant_id uuid references public.bonus_grants (id) on delete set null,
  request_id uuid references public.requests (id) on delete set null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index wallet_ledger_provider_idx on public.wallet_ledger (provider_id, created_at desc);
create index wallet_ledger_request_idx on public.wallet_ledger (request_id) where request_id is not null;
create trigger wallet_ledger_append_only before update or delete on public.wallet_ledger
  for each row execute function public.forbid_change();

create table public.signup_bonus_rules (
  market_id uuid primary key references public.markets (id) on delete cascade,
  enabled boolean not null default false,
  amount_cents integer not null default 5000 check (amount_cents between 0 and 100000),
  expiry_days integer not null default 60 check (expiry_days between 1 and 365),
  starts_on date,
  ends_on date,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- Milestone, referral and reactivation bonuses: off by default, per market.
create table public.credit_rules (
  market_id uuid not null references public.markets (id) on delete cascade,
  kind text not null check (kind in ('milestone', 'referral', 'reactivation')),
  enabled boolean not null default false,
  amount_cents integer not null default 2000 check (amount_cents between 0 and 100000),
  expiry_days integer not null default 60 check (expiry_days between 1 and 365),
  threshold integer not null default 10 check (threshold between 1 and 1000),
  budget_cents integer not null default 50000 check (budget_cents >= 0),
  used_cents integer not null default 0 check (used_cents >= 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (market_id, kind)
);

create table public.credit_limits (
  role public.staff_role primary key,
  per_grant_cents integer check (per_grant_cents is null or per_grant_cents >= 0),
  per_campaign_cents integer check (per_campaign_cents is null or per_campaign_cents >= 0),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.credit_limits (role, per_grant_cents, per_campaign_cents) values
  ('super_admin', null, null), ('ops_manager', 10000, 100000);

-- One signup bonus per business: identifiers are stored as hashes of normalized values.
create table public.provider_identifiers (
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null check (kind in ('ein', 'phone', 'insurance_policy', 'bank_account', 'device')),
  value_hash text not null check (length(value_hash) = 64),
  created_at timestamptz not null default now(),
  primary key (provider_id, kind, value_hash)
);
create index provider_identifiers_hash_idx on public.provider_identifiers (kind, value_hash);

create table public.provider_review_flags (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null check (kind in ('duplicate_business')),
  data jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'cleared', 'confirmed')),
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);

-- In-app notices for providers (welcome credit, expiry reminders, campaign messages).
create table public.provider_notices (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null check (kind in ('bonus_welcome', 'bonus_granted', 'bonus_expiring')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index provider_notices_once on public.provider_notices (provider_id, kind, ((data ->> 'grant_id')), ((data ->> 'days')));

-- ---------------------------------------------------------------------------------------------
-- RLS: providers' owners and managers read their own money; finance and managers read all.
-- Nobody writes directly: every change goes through the functions below.
-- ---------------------------------------------------------------------------------------------
alter table public.credit_campaigns enable row level security;
alter table public.bonus_grants enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.signup_bonus_rules enable row level security;
alter table public.credit_rules enable row level security;
alter table public.credit_limits enable row level security;
alter table public.provider_identifiers enable row level security;
alter table public.provider_review_flags enable row level security;
alter table public.provider_notices enable row level security;
revoke all on public.credit_campaigns, public.bonus_grants, public.wallet_ledger, public.signup_bonus_rules,
  public.credit_rules, public.credit_limits, public.provider_identifiers, public.provider_review_flags,
  public.provider_notices from anon, authenticated;
grant select on public.credit_campaigns, public.bonus_grants, public.wallet_ledger, public.signup_bonus_rules,
  public.credit_rules, public.credit_limits, public.provider_review_flags, public.provider_notices to authenticated;

create policy "money staff read campaigns" on public.credit_campaigns for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance'));
create policy "money staff read grants" on public.bonus_grants for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance')
         and (market_id is null or public.staff_can_access_market(market_id)));
create policy "owners and managers read their grants" on public.bonus_grants for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));
create policy "money staff read the ledger" on public.wallet_ledger for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance')
         and (market_id is null or public.staff_can_access_market(market_id)));
create policy "owners and managers read their ledger" on public.wallet_ledger for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));
create policy "money staff read signup rules" on public.signup_bonus_rules for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance'));
create policy "money staff read credit rules" on public.credit_rules for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance'));
create policy "money staff read limits" on public.credit_limits for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance'));
create policy "managers read review flags" on public.provider_review_flags for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager'));
create policy "members read their notices" on public.provider_notices for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (definer, not granted to anyone)
-- ---------------------------------------------------------------------------------------------
create function public.wallet_audit(p_action text, p_entity text, p_id text, p_market uuid, p_data jsonb)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), coalesce(public.jwt_staff_role()::text, 'system'), p_action, p_entity, p_id, p_market, p_data);
$$;
revoke all on function public.wallet_audit(text, text, text, uuid, jsonb) from public, anon, authenticated;

create function public.provider_market(p_provider_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.market_ids[1] from public.providers p where p.id = p_provider_id;
$$;
revoke all on function public.provider_market(uuid) from public, anon, authenticated;

-- Creates a grant, its ledger row and its audit row. Returns the grant id.
create function public.create_bonus_grant(
  p_provider_id uuid, p_source text, p_amount_cents integer, p_expires_at timestamptz,
  p_reason text default null, p_note text default null, p_campaign_id uuid default null,
  p_plan_allowed boolean default false, p_refund_of uuid default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_market uuid := public.provider_market(p_provider_id);
begin
  insert into public.bonus_grants (provider_id, market_id, source, reason, note, amount_cents, remaining_cents,
                                   expires_at, plan_allowed, campaign_id, refund_of, created_by)
  values (p_provider_id, v_market, p_source, p_reason, nullif(trim(coalesce(p_note, '')), ''), p_amount_cents,
          p_amount_cents, p_expires_at, p_plan_allowed, p_campaign_id, p_refund_of, auth.uid())
  returning id into v_id;
  insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, grant_id, note, actor_id)
  values (p_provider_id, v_market, case when p_source = 'refund' then 'bonus_refund' else 'bonus_grant' end,
          'bonus', p_amount_cents, v_id, coalesce(p_reason, p_source), auth.uid());
  perform public.wallet_audit('wallet.bonus_grant', 'provider', p_provider_id::text, v_market,
    jsonb_strip_nulls(jsonb_build_object('grant_id', v_id, 'source', p_source, 'reason', p_reason, 'note', p_note,
      'amount_cents', p_amount_cents, 'expires_at', p_expires_at, 'campaign_id', p_campaign_id)));
  return v_id;
end;
$$;
revoke all on function public.create_bonus_grant(uuid, text, integer, timestamptz, text, text, uuid, boolean, uuid) from public, anon, authenticated;

-- The caller's limit check: 'ok', 'needs_owner' or 'forbidden' (mirrors canGrant in packages/core).
create function public.credit_limit_check(p_kind text, p_cents integer) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.staff_role := public.jwt_staff_role();
  l public.credit_limits;
  v_max integer;
begin
  if v_role is null then return 'forbidden'; end if;
  select * into l from public.credit_limits where role = v_role;
  if not found then return 'forbidden'; end if;
  v_max := case when p_kind = 'grant' then l.per_grant_cents else l.per_campaign_cents end;
  return case when v_max is null or p_cents <= v_max then 'ok' else 'needs_owner' end;
end;
$$;
grant execute on function public.credit_limit_check(text, integer) to authenticated;
revoke all on function public.credit_limit_check(text, integer) from public, anon;

-- ---------------------------------------------------------------------------------------------
-- Spending: bonus credit first (oldest expiring grant first, fees only unless the grant allows
-- plans), then the paid balance. The paid balance may go below zero (owed), as today's manual
-- dispatch fees are recorded before top-ups exist.
-- ---------------------------------------------------------------------------------------------
create function public.charge_wallet(p_provider_id uuid, p_amount_cents integer, p_request_id uuid, p_purpose text default 'fee')
returns table (bonus_cents integer, paid_cents integer)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_left integer := greatest(0, p_amount_cents);
  v_take integer;
  v_bonus integer := 0;
  v_market uuid := public.provider_market(p_provider_id);
  g record;
begin
  perform 1 from public.provider_wallets w where w.provider_id = p_provider_id for update;
  if not found then
    insert into public.provider_wallets (provider_id, balance_cents) values (p_provider_id, 0) on conflict do nothing;
  end if;
  for g in
    select b.id, b.remaining_cents from public.bonus_grants b
     where b.provider_id = p_provider_id and b.remaining_cents > 0 and b.reversed_at is null
       and b.expires_at > now() and (p_purpose = 'fee' or b.plan_allowed)
     order by b.expires_at, b.id
     for update
  loop
    exit when v_left = 0;
    v_take := least(v_left, g.remaining_cents);
    update public.bonus_grants set remaining_cents = remaining_cents - v_take where id = g.id;
    insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, grant_id, request_id, note)
    values (p_provider_id, v_market, 'bonus_use', 'bonus', -v_take, g.id, p_request_id, p_purpose);
    v_left := v_left - v_take;
    v_bonus := v_bonus + v_take;
  end loop;
  if v_left > 0 then
    update public.provider_wallets set balance_cents = balance_cents - v_left, updated_at = now()
     where provider_id = p_provider_id;
    insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, request_id, note)
    values (p_provider_id, v_market, 'fee', 'paid', -v_left, p_request_id, p_purpose);
  end if;
  perform public.wallet_audit('wallet.charge', 'provider', p_provider_id::text, v_market,
    jsonb_build_object('request_id', p_request_id, 'bonus_cents', v_bonus, 'paid_cents', v_left, 'purpose', p_purpose));
  return query select v_bonus, v_left;
end;
$$;
revoke all on function public.charge_wallet(uuid, integer, uuid, text) from public, anon, authenticated;

-- A job fee is now taken from the wallet when a provider is assigned (still no real money).
create or replace function public.record_manual_test_fee(p_provider_id uuid, p_amount_cents integer, p_request_id uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.provider_billing_events (provider_id, kind, amount_cents, request_id)
  values (p_provider_id, 'manual_test', p_amount_cents, p_request_id);
  if p_amount_cents > 0 and not exists (
    select 1 from public.wallet_ledger l where l.request_id = p_request_id and l.kind in ('fee', 'bonus_use')
      and l.provider_id = p_provider_id
  ) then
    perform public.charge_wallet(p_provider_id, p_amount_cents, p_request_id, 'fee');
  end if;
end;
$$;

-- Refunds a job's fee (cancelled job or approved dispute): the credit part returns as bonus
-- credit with the original expiry or 14 days, whichever is later; the paid part to the paid balance.
create function public.refund_job_fee(p_request_id uuid, p_reason text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  u record;
  v_paid integer;
  v_provider uuid;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager', 'finance') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.wallet_ledger where request_id = p_request_id and kind in ('fee_refund', 'bonus_refund')) then
    raise exception 'already refunded' using errcode = '22023';
  end if;
  for u in
    select l.provider_id, l.grant_id, -l.amount_cents as cents, b.expires_at
      from public.wallet_ledger l join public.bonus_grants b on b.id = l.grant_id
     where l.request_id = p_request_id and l.kind = 'bonus_use'
  loop
    perform public.create_bonus_grant(u.provider_id, 'refund', u.cents,
      greatest(u.expires_at, now() + interval '14 days'), null, trim(p_reason), null, false, u.grant_id);
    v_provider := u.provider_id;
  end loop;
  select l.provider_id, -sum(l.amount_cents)::int into v_provider, v_paid
    from public.wallet_ledger l where l.request_id = p_request_id and l.kind = 'fee' group by l.provider_id;
  if coalesce(v_paid, 0) > 0 then
    update public.provider_wallets set balance_cents = balance_cents + v_paid, updated_at = now() where provider_id = v_provider;
    insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, request_id, note, actor_id)
    values (v_provider, public.provider_market(v_provider), 'fee_refund', 'paid', v_paid, p_request_id, trim(p_reason), auth.uid());
  end if;
  perform public.wallet_audit('wallet.fee_refund', 'request', p_request_id::text, null,
    jsonb_build_object('reason', trim(p_reason), 'paid_cents', coalesce(v_paid, 0)));
end;
$$;
grant execute on function public.refund_job_fee(uuid, text) to authenticated;
revoke all on function public.refund_job_fee(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------------------------
-- Grants by staff
-- ---------------------------------------------------------------------------------------------
create function public.grant_bonus_credit(
  p_provider_id uuid, p_amount_cents integer, p_expiry_days integer, p_reason text, p_note text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_check text := public.credit_limit_check('grant', p_amount_cents);
begin
  if v_check = 'forbidden' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_check = 'needs_owner' then raise exception 'above your limit: the owner must approve this grant' using errcode = '42501'; end if;
  if not exists (select 1 from public.providers p where p.id = p_provider_id and public.staff_can_access_market(p.market_ids[1])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_amount_cents < 100 or p_amount_cents > 100000 or p_expiry_days not between 1 and 365 then
    raise exception 'amount or expiry out of range' using errcode = '22023';
  end if;
  insert into public.provider_notices (provider_id, kind, data)
  values (p_provider_id, 'bonus_granted', jsonb_build_object('amount_cents', p_amount_cents,
          'expires_at', now() + make_interval(days => p_expiry_days)));
  return public.create_bonus_grant(p_provider_id, 'manual', p_amount_cents, now() + make_interval(days => p_expiry_days),
                                   p_reason, p_note);
end;
$$;
grant execute on function public.grant_bonus_credit(uuid, integer, integer, text, text) to authenticated;
revoke all on function public.grant_bonus_credit(uuid, integer, integer, text, text) from public, anon;

-- Who a campaign reaches: real, active providers by market, service, inactivity or a pasted list.
create function public.credit_campaign_recipients(
  p_market_id uuid, p_service_id uuid default null, p_inactive_days integer default null, p_provider_ids uuid[] default null
) returns table (provider_id uuid, name text, market_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.market_ids[1]
  from public.providers p
  where public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance')
    and p.status = 'active' and not p.is_demo
    and (p_market_id is null or p_market_id = any (p.market_ids))
    and (p_market_id is null or public.staff_can_access_market(p_market_id))
    and (p_provider_ids is null or p.id = any (p_provider_ids))
    and (p_service_id is null or exists (
      select 1 from public.provider_service_prices sp where sp.provider_id = p.id and sp.service_id = p_service_id and sp.active))
    and (p_inactive_days is null or not exists (
      select 1 from public.requests r where r.assigned_provider_id = p.id
        and r.accepted_at > now() - make_interval(days => p_inactive_days)))
  order by p.created_at, p.id;
$$;
grant execute on function public.credit_campaign_recipients(uuid, uuid, integer, uuid[]) to authenticated;
revoke all on function public.credit_campaign_recipients(uuid, uuid, integer, uuid[]) from public, anon;

-- Runs a campaign: every recipient gets the full amount until the budget cap; the rest are left
-- out (never a partial grant). Returns the number granted.
create function public.run_credit_campaign(
  p_name text, p_market_id uuid, p_service_id uuid, p_inactive_days integer, p_provider_ids uuid[],
  p_amount_cents integer, p_expiry_days integer, p_message text, p_budget_cents integer, p_plan_allowed boolean default false
) returns table (campaign_id uuid, granted integer, left_out integer, total_cents integer)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_check text;
  v_n integer := 0;
  v_all integer;
  r record;
begin
  v_check := public.credit_limit_check('campaign', p_budget_cents);
  if v_check = 'forbidden' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_check = 'needs_owner' then raise exception 'above your limit: the owner must approve this campaign' using errcode = '42501'; end if;
  if p_plan_allowed and public.jwt_staff_role() <> 'super_admin' then
    raise exception 'only the owner lets credit pay plans' using errcode = '42501';
  end if;
  insert into public.credit_campaigns (name, market_id, audience, amount_cents, expiry_days, message, budget_cents, plan_allowed, created_by)
  values (trim(p_name), p_market_id,
          jsonb_strip_nulls(jsonb_build_object('service_id', p_service_id, 'inactive_days', p_inactive_days, 'provider_ids', p_provider_ids)),
          p_amount_cents, p_expiry_days, nullif(trim(coalesce(p_message, '')), ''), p_budget_cents, p_plan_allowed, auth.uid())
  returning id into v_id;
  select count(*) into v_all from public.credit_campaign_recipients(p_market_id, p_service_id, p_inactive_days, p_provider_ids);
  for r in select * from public.credit_campaign_recipients(p_market_id, p_service_id, p_inactive_days, p_provider_ids) loop
    exit when (v_n + 1) * p_amount_cents > p_budget_cents;
    perform public.create_bonus_grant(r.provider_id, 'campaign', p_amount_cents, now() + make_interval(days => p_expiry_days),
                                      'promotion', p_message, v_id, p_plan_allowed);
    insert into public.provider_notices (provider_id, kind, data)
    values (r.provider_id, 'bonus_granted', jsonb_build_object('amount_cents', p_amount_cents, 'campaign_id', v_id,
            'message', p_message, 'expires_at', now() + make_interval(days => p_expiry_days)));
    v_n := v_n + 1;
  end loop;
  update public.credit_campaigns set granted_cents = v_n * p_amount_cents, recipients = v_n where id = v_id;
  perform public.wallet_audit('wallet.campaign', 'credit_campaign', v_id::text, p_market_id,
    jsonb_build_object('granted', v_n, 'left_out', v_all - v_n, 'total_cents', v_n * p_amount_cents, 'budget_cents', p_budget_cents));
  return query select v_id, v_n, v_all - v_n, v_n * p_amount_cents;
end;
$$;
grant execute on function public.run_credit_campaign(text, uuid, uuid, integer, uuid[], integer, integer, text, integer, boolean) to authenticated;
revoke all on function public.run_credit_campaign(text, uuid, uuid, integer, uuid[], integer, integer, text, integer, boolean) from public, anon;

-- The owner removes unused credit (for example fraud). Used credit stays used.
create function public.reverse_bonus_credit(p_grant_id uuid, p_reason text) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  g public.bonus_grants;
begin
  if public.jwt_staff_role() is distinct from 'super_admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'a reason is required' using errcode = '22023'; end if;
  select * into g from public.bonus_grants where id = p_grant_id for update;
  if not found or g.reversed_at is not null or g.expires_at <= now() or g.remaining_cents = 0 then return 0; end if;
  update public.bonus_grants set remaining_cents = 0, reversed_at = now() where id = g.id;
  insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, grant_id, note, actor_id)
  values (g.provider_id, g.market_id, 'bonus_reversal', 'bonus', -g.remaining_cents, g.id, trim(p_reason), auth.uid());
  perform public.wallet_audit('wallet.bonus_reversal', 'provider', g.provider_id::text, g.market_id,
    jsonb_build_object('grant_id', g.id, 'cents', g.remaining_cents, 'reason', trim(p_reason)));
  return g.remaining_cents;
end;
$$;
grant execute on function public.reverse_bonus_credit(uuid, text) to authenticated;
revoke all on function public.reverse_bonus_credit(uuid, text) from public, anon;

-- Expiry job (cron, or the owner): expires what is left on past grants; queues reminders 7 days
-- and 1 day before. Returns the number of grants expired.
create function public.expire_bonus_credits() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  g record;
  v_n integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and public.jwt_staff_role() is distinct from 'super_admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for g in
    select * from public.bonus_grants where remaining_cents > 0 and reversed_at is null and expires_at <= now() for update
  loop
    update public.bonus_grants set remaining_cents = 0, expired_at = now() where id = g.id;
    insert into public.wallet_ledger (provider_id, market_id, kind, balance, amount_cents, grant_id, note)
    values (g.provider_id, g.market_id, 'bonus_expiry', 'bonus', -g.remaining_cents, g.id, 'expired');
    perform public.wallet_audit('wallet.bonus_expiry', 'provider', g.provider_id::text, g.market_id,
      jsonb_build_object('grant_id', g.id, 'cents', g.remaining_cents));
    v_n := v_n + 1;
  end loop;
  insert into public.provider_notices (provider_id, kind, data)
  select b.provider_id, 'bonus_expiring', jsonb_build_object('grant_id', b.id, 'days', d.days::text,
         'cents', b.remaining_cents, 'expires_at', b.expires_at)
    from public.bonus_grants b
    cross join (values (7), (1)) d(days)
   where b.remaining_cents > 0 and b.reversed_at is null
     and ceil(extract(epoch from (b.expires_at - now())) / 86400) = d.days
  on conflict do nothing;
  return v_n;
end;
$$;
grant execute on function public.expire_bonus_credits() to authenticated, service_role;
revoke all on function public.expire_bonus_credits() from public, anon;

-- ---------------------------------------------------------------------------------------------
-- Settings by staff
-- ---------------------------------------------------------------------------------------------
create function public.set_signup_bonus(p_market_id uuid, p_enabled boolean, p_amount_cents integer, p_expiry_days integer,
                                        p_starts_on date, p_ends_on date) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if public.credit_limit_check('grant', p_amount_cents) <> 'ok' then
    raise exception 'above your limit: the owner must set this bonus' using errcode = '42501';
  end if;
  insert into public.signup_bonus_rules (market_id, enabled, amount_cents, expiry_days, starts_on, ends_on, updated_by, updated_at)
  values (p_market_id, p_enabled, p_amount_cents, p_expiry_days, p_starts_on, p_ends_on, auth.uid(), now())
  on conflict (market_id) do update set enabled = excluded.enabled, amount_cents = excluded.amount_cents,
    expiry_days = excluded.expiry_days, starts_on = excluded.starts_on, ends_on = excluded.ends_on,
    updated_by = excluded.updated_by, updated_at = now();
  perform public.wallet_audit('wallet.signup_bonus', 'market', p_market_id::text, p_market_id,
    jsonb_build_object('enabled', p_enabled, 'amount_cents', p_amount_cents, 'expiry_days', p_expiry_days,
                       'starts_on', p_starts_on, 'ends_on', p_ends_on));
end;
$$;
grant execute on function public.set_signup_bonus(uuid, boolean, integer, integer, date, date) to authenticated;
revoke all on function public.set_signup_bonus(uuid, boolean, integer, integer, date, date) from public, anon;

create function public.set_credit_rule(p_market_id uuid, p_kind text, p_enabled boolean, p_amount_cents integer,
                                       p_expiry_days integer, p_threshold integer, p_budget_cents integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if public.credit_limit_check('campaign', p_budget_cents) <> 'ok' then
    raise exception 'above your limit: the owner must set this budget' using errcode = '42501';
  end if;
  insert into public.credit_rules (market_id, kind, enabled, amount_cents, expiry_days, threshold, budget_cents, updated_by)
  values (p_market_id, p_kind, p_enabled, p_amount_cents, p_expiry_days, p_threshold, p_budget_cents, auth.uid())
  on conflict (market_id, kind) do update set enabled = excluded.enabled, amount_cents = excluded.amount_cents,
    expiry_days = excluded.expiry_days, threshold = excluded.threshold, budget_cents = excluded.budget_cents,
    updated_by = excluded.updated_by, updated_at = now();
  perform public.wallet_audit('wallet.credit_rule', 'market', p_market_id::text, p_market_id,
    jsonb_build_object('kind', p_kind, 'enabled', p_enabled, 'amount_cents', p_amount_cents, 'budget_cents', p_budget_cents));
end;
$$;
grant execute on function public.set_credit_rule(uuid, text, boolean, integer, integer, integer, integer) to authenticated;
revoke all on function public.set_credit_rule(uuid, text, boolean, integer, integer, integer, integer) from public, anon;

create function public.set_credit_limit(p_role public.staff_role, p_per_grant_cents integer, p_per_campaign_cents integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() is distinct from 'super_admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role = 'super_admin' then raise exception 'the owner has no limit' using errcode = '22023'; end if;
  insert into public.credit_limits (role, per_grant_cents, per_campaign_cents, updated_by, updated_at)
  values (p_role, p_per_grant_cents, p_per_campaign_cents, auth.uid(), now())
  on conflict (role) do update set per_grant_cents = excluded.per_grant_cents,
    per_campaign_cents = excluded.per_campaign_cents, updated_by = excluded.updated_by, updated_at = now();
  perform public.wallet_audit('wallet.credit_limit', 'staff_role', p_role::text, null,
    jsonb_build_object('per_grant_cents', p_per_grant_cents, 'per_campaign_cents', p_per_campaign_cents));
end;
$$;
grant execute on function public.set_credit_limit(public.staff_role, integer, integer) to authenticated;
revoke all on function public.set_credit_limit(public.staff_role, integer, integer) from public, anon;

-- Identifiers for duplicate checks, normalized and hashed by the caller's server code.
create function public.set_provider_identifier(p_provider_id uuid, p_kind text, p_value_hash text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') and public.jwt_provider_role(p_provider_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.provider_identifiers (provider_id, kind, value_hash) values (p_provider_id, p_kind, p_value_hash)
  on conflict do nothing;
end;
$$;
grant execute on function public.set_provider_identifier(uuid, text, text) to authenticated;
revoke all on function public.set_provider_identifier(uuid, text, text) from public, anon;

create function public.clear_review_flag(p_flag_id uuid, p_grant boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  f public.provider_review_flags;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.provider_review_flags set status = case when p_grant then 'cleared' else 'confirmed' end,
         resolved_by = auth.uid(), resolved_at = now()
   where id = p_flag_id and status = 'open' returning * into f;
  if found and p_grant then perform public.grant_signup_bonus(f.provider_id, true); end if;
  perform public.wallet_audit('wallet.review_flag', 'provider', f.provider_id::text, null,
    jsonb_build_object('flag_id', p_flag_id, 'granted', p_grant));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Signup bonus on approval (a provider becomes active), once per business
-- ---------------------------------------------------------------------------------------------
create function public.grant_signup_bonus(p_provider_id uuid, p_reviewed boolean default false) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.providers;
  r public.signup_bonus_rules;
  v_dupes jsonb;
  v_grant uuid;
  v_expires timestamptz;
begin
  select * into p from public.providers where id = p_provider_id;
  if not found or p.is_demo or p.status <> 'active' then return; end if;
  if exists (select 1 from public.bonus_grants where provider_id = p.id and source = 'signup') then return; end if;
  select * into r from public.signup_bonus_rules where market_id = p.market_ids[1];
  if not found or not r.enabled or r.amount_cents <= 0
     or (r.starts_on is not null and current_date < r.starts_on)
     or (r.ends_on is not null and current_date > r.ends_on) then return; end if;
  -- The business phone is an identifier too (normalized to 10 digits, stored as a hash).
  if length(regexp_replace(coalesce(p.dispatch_phone, ''), '\D', '', 'g')) >= 10 then
    insert into public.provider_identifiers (provider_id, kind, value_hash)
    values (p.id, 'phone', encode(extensions.digest(right(regexp_replace(p.dispatch_phone, '\D', '', 'g'), 10), 'sha256'), 'hex'))
    on conflict do nothing;
  end if;
  if not p_reviewed then
    select jsonb_agg(distinct jsonb_build_object('provider_id', o.provider_id, 'kind', o.kind)) into v_dupes
      from public.provider_identifiers mine
      join public.provider_identifiers o on o.kind = mine.kind and o.value_hash = mine.value_hash and o.provider_id <> mine.provider_id
     where mine.provider_id = p.id;
    if v_dupes is not null then
      insert into public.provider_review_flags (provider_id, kind, data)
      values (p.id, 'duplicate_business', jsonb_build_object('matches', v_dupes, 'amount_cents', r.amount_cents));
      perform public.wallet_audit('wallet.signup_flagged', 'provider', p.id::text, p.market_ids[1], jsonb_build_object('matches', v_dupes));
      return;
    end if;
  end if;
  v_expires := now() + make_interval(days => r.expiry_days);
  v_grant := public.create_bonus_grant(p.id, 'signup', r.amount_cents, v_expires, 'promotion', 'signup bonus');
  insert into public.provider_notices (provider_id, kind, data)
  values (p.id, 'bonus_welcome', jsonb_build_object('grant_id', v_grant, 'amount_cents', r.amount_cents, 'expires_at', v_expires));
end;
$$;
revoke all on function public.grant_signup_bonus(uuid, boolean) from public, anon, authenticated;
grant execute on function public.clear_review_flag(uuid, boolean) to authenticated;
revoke all on function public.clear_review_flag(uuid, boolean) from public, anon;

create function public.providers_signup_bonus() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform public.grant_signup_bonus(new.id);
  end if;
  return new;
end;
$$;
create trigger providers_signup_bonus after insert or update of status on public.providers
  for each row execute function public.providers_signup_bonus();

-- Milestone bonus (off by default): after the Nth completed job, within the rule's budget.
create function public.requests_milestone_bonus() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.credit_rules;
  v_done integer;
begin
  if new.completed_at is null or old.completed_at is not null or new.assigned_provider_id is null then return new; end if;
  select * into r from public.credit_rules where market_id = new.market_id and kind = 'milestone' and enabled for update;
  if not found or r.used_cents + r.amount_cents > r.budget_cents then return new; end if;
  select count(*) into v_done from public.requests where assigned_provider_id = new.assigned_provider_id and completed_at is not null;
  if v_done = r.threshold and not exists (
    select 1 from public.bonus_grants where provider_id = new.assigned_provider_id and source = 'milestone') then
    perform public.create_bonus_grant(new.assigned_provider_id, 'milestone', r.amount_cents,
      now() + make_interval(days => r.expiry_days), 'promotion', format('%s completed jobs', r.threshold));
    update public.credit_rules set used_cents = used_cents + r.amount_cents where market_id = r.market_id and kind = 'milestone';
  end if;
  return new;
end;
$$;
create trigger requests_milestone_bonus after update of completed_at on public.requests
  for each row execute function public.requests_milestone_bonus();

-- ---------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------
-- A provider's two balances (owners and managers of that provider, or money staff).
create function public.wallet_summary(p_provider_id uuid)
returns table (paid_cents integer, bonus_cents integer, next_expiry timestamptz, next_expiry_cents integer)
language sql stable security definer set search_path = '' as $$
  with ok as (
    select public.jwt_provider_role(p_provider_id) in ('owner', 'manager')
        or public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance') as yes
  ), g as (
    select b.expires_at, b.remaining_cents from public.bonus_grants b
     where b.provider_id = p_provider_id and b.remaining_cents > 0 and b.reversed_at is null and b.expires_at > now()
  ), first as (select min(expires_at) as at from g)
  select coalesce((select w.balance_cents from public.provider_wallets w where w.provider_id = p_provider_id), 0),
         coalesce((select sum(remaining_cents) from g), 0)::int,
         (select at from first),
         (select sum(remaining_cents)::int from g where expires_at = (select at from first))
  from ok where ok.yes;
$$;
grant execute on function public.wallet_summary(uuid) to authenticated;
revoke all on function public.wallet_summary(uuid) from public, anon;

-- Finance: outstanding bonus credit (granted, not used, not expired) per market, a liability.
create function public.outstanding_bonus_credit()
returns table (market_id uuid, outstanding_cents bigint, providers integer, used_cents bigint, expired_cents bigint)
language sql stable security definer set search_path = '' as $$
  select b.market_id,
         sum(b.remaining_cents) filter (where b.reversed_at is null and b.expires_at > now()),
         count(distinct b.provider_id) filter (where b.remaining_cents > 0 and b.reversed_at is null and b.expires_at > now())::int,
         (select -coalesce(sum(l.amount_cents), 0) from public.wallet_ledger l where l.market_id is not distinct from b.market_id and l.kind = 'bonus_use'),
         (select -coalesce(sum(l.amount_cents), 0) from public.wallet_ledger l where l.market_id is not distinct from b.market_id and l.kind = 'bonus_expiry')
  from public.bonus_grants b
  where public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance')
    and (b.market_id is null or public.staff_can_access_market(b.market_id))
  group by b.market_id;
$$;
grant execute on function public.outstanding_bonus_credit() to authenticated;
revoke all on function public.outstanding_bonus_credit() from public, anon;

-- Campaign report: granted, used, expired, providers who later topped up ("conversion to paid"),
-- jobs completed using credit, and fee revenue from those providers in the following 60 days.
create function public.credit_campaign_report()
returns table (campaign_id uuid, name text, market_id uuid, created_at timestamptz, granted_cents bigint,
               used_cents bigint, expired_cents bigint, recipients integer, topped_up integer,
               jobs_on_credit integer, revenue_60d_cents bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.market_id, c.created_at, c.granted_cents::bigint,
         coalesce((select -sum(l.amount_cents) from public.wallet_ledger l join public.bonus_grants b on b.id = l.grant_id
                    where b.campaign_id = c.id and l.kind = 'bonus_use'), 0),
         coalesce((select -sum(l.amount_cents) from public.wallet_ledger l join public.bonus_grants b on b.id = l.grant_id
                    where b.campaign_id = c.id and l.kind = 'bonus_expiry'), 0),
         c.recipients,
         (select count(distinct t.provider_id)::int from public.wallet_ledger t join public.bonus_grants b on b.provider_id = t.provider_id
           where b.campaign_id = c.id and t.kind = 'topup' and t.created_at > c.created_at),
         (select count(distinct l.request_id)::int from public.wallet_ledger l join public.bonus_grants b on b.id = l.grant_id
           join public.requests r on r.id = l.request_id and r.completed_at is not null
           where b.campaign_id = c.id and l.kind = 'bonus_use'),
         coalesce((select -sum(l.amount_cents) from public.wallet_ledger l
                    where l.kind in ('fee', 'bonus_use') and l.created_at between c.created_at and c.created_at + interval '60 days'
                      and l.provider_id in (select b.provider_id from public.bonus_grants b where b.campaign_id = c.id)), 0)
  from public.credit_campaigns c
  where public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance')
  order by c.created_at desc;
$$;
grant execute on function public.credit_campaign_report() to authenticated;
revoke all on function public.credit_campaign_report() from public, anon;

-- ---------------------------------------------------------------------------------------------
-- Real providers from approved applications, and approval (status active) by managers. Until now
-- providers only came from seed rows; the signup bonus needs a real approval step.
-- ---------------------------------------------------------------------------------------------
alter table public.providers add column application_id uuid unique references public.provider_applications (id) on delete set null;

create function public.create_provider_from_application(p_application_id uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.provider_applications;
  v_id uuid;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from public.provider_applications where id = p_application_id and status = 'approved';
  if not found then raise exception 'application not approved' using errcode = '22023'; end if;
  select id into v_id from public.providers where application_id = a.id;
  if v_id is not null then return v_id; end if;
  insert into public.providers (name, status, market_ids, dispatch_phone, application_id)
  values (a.company_name, 'onboarding', a.market_ids, a.phone, a.id)
  returning id into v_id;
  perform public.wallet_audit('provider.created', 'provider', v_id::text, a.market_ids[1],
    jsonb_build_object('application_id', a.id));
  return v_id;
end;
$$;
grant execute on function public.create_provider_from_application(uuid) to authenticated;
revoke all on function public.create_provider_from_application(uuid) from public, anon;

create function public.set_provider_status(p_provider_id uuid, p_status public.provider_status, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_old public.provider_status;
  v_market uuid;
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager') then raise exception 'forbidden' using errcode = '42501'; end if;
  select status, market_ids[1] into v_old, v_market from public.providers where id = p_provider_id for update;
  if not found or (v_market is not null and not public.staff_can_access_market(v_market)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status in ('paused', 'suspended', 'closed') and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  update public.providers set status = p_status, status_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_provider_id;
  perform public.wallet_audit('provider.status', 'provider', p_provider_id::text, v_market,
    jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));
end;
$$;
grant execute on function public.set_provider_status(uuid, public.provider_status, text) to authenticated;
revoke all on function public.set_provider_status(uuid, public.provider_status, text) from public, anon;
