-- RSOS-114: provider plans (Basic, Pro) and Featured placement, admin-priced.
--
-- - There is no free plan: a provider needs an active Basic or Pro plan to receive requests
--   (nearby_providers lists only those). Onboarding and verification work without one.
-- - Pro: the per-job fee is discounted (fee_discount_bps) and Pro providers get a first look at new
--   requests (first_look_seconds) before everyone else.
-- - Featured: bought per market (optionally per service), limited slots per market, a waitlist when
--   full. Placement rules (price within X% of the cheapest, arrival within Y minutes of the fastest)
--   live in featured_settings; packages/core/src/plans.ts applies them to a quote list.
-- - Prices have effective dates. A change applies to new subscribers from its date and to existing
--   ones from their first billing date after the notice period, unless they are grandfathered.
-- - Billing is fake until batch 6 (Stripe): subscription_charges records what would be charged.

-- ---------------------------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------------------------
create table public.plan_catalog (
  plan text primary key check (plan in ('basic', 'pro', 'featured')),
  name text not null check (length(name) between 2 and 40),
  fee_discount_bps integer not null default 0 check (fee_discount_bps between 0 and 5000),
  first_look_seconds integer not null default 0 check (first_look_seconds between 0 and 30),
  technician_limit integer check (technician_limit is null or technician_limit between 1 and 1000),
  insights_level text not null default 'basic' check (insights_level in ('basic', 'full')),
  auto_topup boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  bullets jsonb not null default '{"en": [], "es": []}'::jsonb check (jsonb_typeof(bullets) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.plan_catalog enable row level security;
create policy "staff read plan catalog" on public.plan_catalog for select to authenticated
  using (public.jwt_staff_role() is not null);

insert into public.plan_catalog (plan, name, fee_discount_bps, first_look_seconds, technician_limit, insights_level, auto_topup, sort_order, bullets) values
  ('basic', 'Basic', 0, 0, 2, 'basic', false, 1,
   '{"en": ["All requests in your service area", "Standard profile", "Up to 2 technicians", "Basic insights: jobs, earnings, acceptance rate", "Manual wallet top-up"], "es": ["Todas las solicitudes en tu zona de servicio", "Perfil estándar", "Hasta 2 técnicos", "Estadísticas básicas: trabajos, ingresos, tasa de aceptación", "Recarga manual de la billetera"]}'),
  ('pro', 'Pro', 1500, 15, null, 'full', true, 2,
   '{"en": ["15% off every job fee", "First look: offers 15 seconds before others", "Pro badge on your profile and quotes", "Unlimited technicians and office dispatchers", "Full insights: win rate, price comparison, best hours", "Auto top-up"], "es": ["15% de descuento en cada tarifa por trabajo", "Primera vista: ofertas 15 segundos antes que los demás", "Insignia Pro en tu perfil y cotizaciones", "Técnicos y despachadores ilimitados", "Estadísticas completas: tasa de éxito, comparación de precios, mejores horas", "Recarga automática"]}'),
  ('featured', 'Featured', 0, 0, null, 'basic', false, 3,
   '{"en": ["Your quote at the top with a Featured label when it meets the price and arrival rules", "Top spot on the city page provider list", "Monthly, per market, cancel anytime"], "es": ["Tu cotización arriba con la etiqueta Destacado cuando cumple las reglas de precio y llegada", "Primer lugar en la lista de proveedores de la ciudad", "Mensual, por mercado, cancela cuando quieras"]}');

-- Prices: market_id null is the default for every market; a market row overrides it. Append-only.
create table public.plan_prices (
  id bigint generated always as identity primary key,
  plan text not null references public.plan_catalog (plan),
  market_id uuid references public.markets (id) on delete cascade,
  price_cents integer not null check (price_cents > 0),
  effective_from timestamptz not null,
  grandfather boolean not null default false,
  notice_days integer not null default 30 check (notice_days between 0 and 365),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- No free plan: Basic costs at least 20 USD a month.
  constraint basic_minimum check (plan <> 'basic' or price_cents >= 2000)
);
create index plan_prices_lookup on public.plan_prices (plan, market_id, effective_from desc);
alter table public.plan_prices enable row level security;
create policy "staff read plan prices" on public.plan_prices for select to authenticated
  using (public.jwt_staff_role() is not null and (market_id is null or public.staff_can_access_market(market_id)));
create trigger plan_prices_append_only before update or delete on public.plan_prices
  for each row execute function public.forbid_change();

insert into public.plan_prices (plan, market_id, price_cents, effective_from) values
  ('basic', null, 2000, '2026-11-01'),
  ('pro', null, 12900, '2026-11-01'),
  ('featured', null, 3750, '2026-11-01');

-- Featured slots and placement rules per market (defaults when no row).
create table public.featured_settings (
  market_id uuid primary key references public.markets (id) on delete cascade,
  slots integer not null default 3 check (slots between 1 and 20),
  price_rule_pct integer not null default 15 check (price_rule_pct between 0 and 100),
  eta_rule_minutes integer not null default 10 check (eta_rule_minutes between 0 and 60),
  service_slots boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.featured_settings enable row level security;
create policy "staff read featured settings" on public.featured_settings for select to authenticated
  using (public.staff_can_access_market(market_id));

-- Optional first-month offer per market and plan (off by default, with an end date).
create table public.plan_offers (
  market_id uuid not null references public.markets (id) on delete cascade,
  plan text not null references public.plan_catalog (plan) check (plan in ('basic', 'pro')),
  first_month_cents integer not null check (first_month_cents >= 0),
  ends_at timestamptz not null,
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (market_id, plan)
);
alter table public.plan_offers enable row level security;
create policy "staff read plan offers" on public.plan_offers for select to authenticated
  using (public.staff_can_access_market(market_id));

-- ---------------------------------------------------------------------------------------------
-- Subscriptions (fake billing until batch 6)
-- ---------------------------------------------------------------------------------------------
create table public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  plan text not null references public.plan_catalog (plan),
  market_id uuid not null references public.markets (id),
  service_id uuid references public.services (id),
  status text not null default 'active' check (status in ('active', 'waitlist', 'ended')),
  price_cents integer not null check (price_cents >= 0),
  grandfathered boolean not null default false,
  next_price_cents integer check (next_price_cents is null or next_price_cents > 0),
  next_price_from timestamptz,
  next_plan text references public.plan_catalog (plan) check (next_plan is null or next_plan in ('basic', 'pro')),
  cancel_at_period_end boolean not null default false,
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '1 month',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_market check (plan = 'featured' or service_id is null)
);
-- One active base plan per provider; one active Featured per provider, market and service.
create unique index provider_subscriptions_one_base on public.provider_subscriptions (provider_id)
  where plan in ('basic', 'pro') and status = 'active';
create unique index provider_subscriptions_one_featured on public.provider_subscriptions
  (provider_id, market_id, coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where plan = 'featured' and status in ('active', 'waitlist');
create index provider_subscriptions_market on public.provider_subscriptions (market_id, plan, status);
create trigger provider_subscriptions_updated_at before update on public.provider_subscriptions
  for each row execute function public.set_updated_at();
alter table public.provider_subscriptions enable row level security;
create policy "providers read own subscriptions" on public.provider_subscriptions for select to authenticated
  using (public.jwt_provider_role(provider_id) is not null);
create policy "staff read subscriptions" on public.provider_subscriptions for select to authenticated
  using (public.staff_can_access_market(market_id));

create table public.subscription_charges (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.provider_subscriptions (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null check (kind in ('period', 'prorata', 'offer')),
  amount_cents integer not null check (amount_cents >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  adapter text not null default 'fake',
  created_at timestamptz not null default now()
);
create index subscription_charges_provider on public.subscription_charges (provider_id, created_at desc);
alter table public.subscription_charges enable row level security;
create policy "owners read own plan charges" on public.subscription_charges for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));
create policy "finance reads plan charges" on public.subscription_charges for select to authenticated
  using (public.staff_role_in('super_admin', 'ops_manager', 'finance'));
create trigger subscription_charges_append_only before update or delete on public.subscription_charges
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------------------------
-- Reading prices and plans
-- ---------------------------------------------------------------------------------------------
-- The price a new subscriber pays for a plan in a market at a time (market row first, then default).
create function public.plan_price(p_plan text, p_market_id uuid, p_at timestamptz default now())
returns integer
language sql stable security definer set search_path = '' as $$
  select p.price_cents from public.plan_prices p
  where p.plan = p_plan and (p.market_id = p_market_id or p.market_id is null) and p.effective_from <= p_at
  order by (p.market_id is not null) desc, p.effective_from desc, p.id desc
  limit 1;
$$;
revoke all on function public.plan_price(text, uuid, timestamptz) from public;
grant execute on function public.plan_price(text, uuid, timestamptz) to anon, authenticated;

-- The provider's active base plan ('basic' or 'pro'), or null (no offers without one).
create function public.provider_plan(p_provider_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.plan from public.provider_subscriptions s
  where s.provider_id = p_provider_id and s.plan in ('basic', 'pro') and s.status = 'active'
  limit 1;
$$;
revoke all on function public.provider_plan(uuid) from public, anon;
grant execute on function public.provider_plan(uuid) to authenticated;

create function public.provider_fee_discount_bps(p_provider_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.fee_discount_bps from public.plan_catalog c
                   where c.plan = public.provider_plan(p_provider_id)), 0);
$$;
revoke all on function public.provider_fee_discount_bps(uuid) from public, anon;
grant execute on function public.provider_fee_discount_bps(uuid) to authenticated;

-- Public catalog for one market: the website pricing page and the provider portal.
create function public.public_plan_catalog(p_market_slug text default null)
returns table (plan text, name text, price_cents integer, fee_discount_bps integer, first_look_seconds integer,
               technician_limit integer, insights_level text, auto_topup boolean, bullets jsonb, sort_order integer,
               offer_cents integer, offer_ends_at timestamptz, featured_slots integer, featured_taken integer)
language sql stable security definer set search_path = '' as $$
  with m as (select id from public.markets where slug = p_market_slug and status in ('test', 'active'))
  select c.plan, c.name, public.plan_price(c.plan, (select id from m)), c.fee_discount_bps, c.first_look_seconds,
         c.technician_limit, c.insights_level, c.auto_topup, c.bullets, c.sort_order,
         o.first_month_cents, o.ends_at,
         case when c.plan = 'featured' then coalesce(fs.slots, 3) end,
         case when c.plan = 'featured' then (select count(*)::int from public.provider_subscriptions s
            where s.plan = 'featured' and s.status = 'active' and s.market_id = (select id from m)) end
  from public.plan_catalog c
  left join public.plan_offers o on o.market_id = (select id from m) and o.plan = c.plan and o.active and o.ends_at > now()
  left join public.featured_settings fs on fs.market_id = (select id from m)
  where c.active
  order by c.sort_order;
$$;
revoke all on function public.public_plan_catalog(text) from public;
grant execute on function public.public_plan_catalog(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Starting, changing and cancelling (provider owners and managers; owner and ops for any provider)
-- ---------------------------------------------------------------------------------------------
create function public.can_manage_plan(p_provider_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.jwt_provider_role(p_provider_id) in ('owner', 'manager'), false)
      or public.staff_role_in('super_admin', 'ops_manager');
$$;
revoke all on function public.can_manage_plan(uuid) from public, anon;
grant execute on function public.can_manage_plan(uuid) to authenticated;

-- Starts Basic or Pro, or upgrades Basic to Pro now (pro rata), or schedules a downgrade to Basic at
-- the end of the paid month. Returns the subscription id.
create function public.start_plan(p_provider_id uuid, p_plan text, p_market_id uuid default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sub public.provider_subscriptions;
  v_market uuid;
  v_price integer;
  v_offer integer;
  v_id uuid;
  v_left numeric;
begin
  if not public.can_manage_plan(p_provider_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_plan not in ('basic', 'pro') then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  select coalesce(p_market_id, p.market_ids[1]) into v_market from public.providers p where p.id = p_provider_id;
  if v_market is null then
    raise exception 'the provider has no market yet' using errcode = '22023';
  end if;
  v_price := public.plan_price(p_plan, v_market);
  select * into v_sub from public.provider_subscriptions s
   where s.provider_id = p_provider_id and s.plan in ('basic', 'pro') and s.status = 'active' for update;

  if v_sub.id is null then
    select o.first_month_cents into v_offer from public.plan_offers o
     where o.market_id = v_market and o.plan = p_plan and o.active and o.ends_at > now();
    insert into public.provider_subscriptions (provider_id, plan, market_id, price_cents)
    values (p_provider_id, p_plan, v_market, v_price)
    returning id into v_id;
    insert into public.subscription_charges (subscription_id, provider_id, kind, amount_cents, period_start, period_end)
    values (v_id, p_provider_id, case when v_offer is null then 'period' else 'offer' end, coalesce(v_offer, v_price),
            now(), now() + interval '1 month');
  elsif v_sub.plan = p_plan then
    -- Same plan: undo a scheduled downgrade or cancellation.
    update public.provider_subscriptions set next_plan = null, cancel_at_period_end = false where id = v_sub.id;
    v_id := v_sub.id;
  elsif p_plan = 'pro' then
    -- Upgrade now, pay the difference for the rest of the month.
    v_left := greatest(0, extract(epoch from v_sub.current_period_end - now()))
              / greatest(1, extract(epoch from v_sub.current_period_end - v_sub.current_period_start));
    update public.provider_subscriptions
       set plan = 'pro', price_cents = v_price, grandfathered = false, next_price_cents = null,
           next_price_from = null, next_plan = null, cancel_at_period_end = false
     where id = v_sub.id;
    insert into public.subscription_charges (subscription_id, provider_id, kind, amount_cents, period_start, period_end)
    values (v_sub.id, p_provider_id, 'prorata', greatest(0, round((v_price - v_sub.price_cents) * v_left))::int,
            now(), v_sub.current_period_end);
    v_id := v_sub.id;
  else
    -- Downgrade: Pro stays until the end of the paid month.
    update public.provider_subscriptions set next_plan = 'basic', cancel_at_period_end = false where id = v_sub.id;
    v_id := v_sub.id;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), coalesce(public.jwt_staff_role()::text, 'provider'), 'plan.start', 'provider', p_provider_id::text,
          v_market, jsonb_build_object('plan', p_plan, 'from', v_sub.plan));
  return v_id;
end;
$$;
revoke all on function public.start_plan(uuid, text, uuid) from public, anon;
grant execute on function public.start_plan(uuid, text, uuid) to authenticated;

-- Cancels at the end of the paid month (base plan or Featured). A waitlist place ends at once.
create function public.cancel_plan(p_subscription_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sub public.provider_subscriptions;
begin
  select * into v_sub from public.provider_subscriptions where id = p_subscription_id for update;
  if v_sub.id is null or not public.can_manage_plan(v_sub.provider_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_sub.status = 'waitlist' then
    update public.provider_subscriptions set status = 'ended', ended_at = now() where id = v_sub.id;
  else
    update public.provider_subscriptions set cancel_at_period_end = true, next_plan = null where id = v_sub.id;
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), coalesce(public.jwt_staff_role()::text, 'provider'), 'plan.cancel', 'provider',
          v_sub.provider_id::text, v_sub.market_id, jsonb_build_object('plan', v_sub.plan));
end;
$$;
revoke all on function public.cancel_plan(uuid) from public, anon;
grant execute on function public.cancel_plan(uuid) to authenticated;

-- Featured in a market (optionally one service): active when a slot is free, else the waitlist.
-- Needs an active base plan.
create function public.join_featured(p_provider_id uuid, p_market_id uuid, p_service_id uuid default null)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_slots integer;
  v_taken integer;
  v_price integer;
  v_status text;
  v_id uuid;
begin
  if not public.can_manage_plan(p_provider_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if public.provider_plan(p_provider_id) is null then
    raise exception 'Featured needs an active Basic or Pro plan' using errcode = '22023';
  end if;
  if not exists (select 1 from public.providers p where p.id = p_provider_id and p_market_id = any (p.market_ids)) then
    raise exception 'the provider does not serve this market' using errcode = '22023';
  end if;
  select coalesce(fs.slots, 3) into v_slots from (select 1) x
    left join public.featured_settings fs on fs.market_id = p_market_id;
  if p_service_id is not null and not coalesce((select fs.service_slots from public.featured_settings fs
                                                 where fs.market_id = p_market_id), false) then
    raise exception 'Featured is sold for the whole market here' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('featured:' || p_market_id::text));
  select count(*)::int into v_taken from public.provider_subscriptions s
   where s.plan = 'featured' and s.status = 'active' and s.market_id = p_market_id;
  v_status := case when v_taken < v_slots then 'active' else 'waitlist' end;
  v_price := public.plan_price('featured', p_market_id);
  insert into public.provider_subscriptions (provider_id, plan, market_id, service_id, status, price_cents)
  values (p_provider_id, 'featured', p_market_id, p_service_id, v_status, v_price)
  returning id into v_id;
  if v_status = 'active' then
    insert into public.subscription_charges (subscription_id, provider_id, kind, amount_cents, period_start, period_end)
    values (v_id, p_provider_id, 'period', v_price, now(), now() + interval '1 month');
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), coalesce(public.jwt_staff_role()::text, 'provider'), 'plan.featured', 'provider',
          p_provider_id::text, p_market_id, jsonb_build_object('status', v_status, 'service_id', p_service_id));
  return v_status;
end;
$$;
revoke all on function public.join_featured(uuid, uuid, uuid) from public, anon;
grant execute on function public.join_featured(uuid, uuid, uuid) to authenticated;

-- Billing periods (fake adapter): renews, applies scheduled prices and downgrades, ends cancelled
-- plans and promotes the Featured waitlist. Run daily by pg_cron.
create function public.run_plan_renewals(p_now timestamptz default now()) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sub public.provider_subscriptions;
  v_n integer := 0;
  v_price integer;
  v_plan text;
  v_next record;
begin
  for v_sub in select * from public.provider_subscriptions
                where status = 'active' and current_period_end <= p_now for update skip locked loop
    v_n := v_n + 1;
    if v_sub.cancel_at_period_end then
      update public.provider_subscriptions set status = 'ended', ended_at = v_sub.current_period_end where id = v_sub.id;
      continue;
    end if;
    v_plan := coalesce(v_sub.next_plan, v_sub.plan);
    v_price := case
      when v_sub.next_plan is not null then public.plan_price(v_plan, v_sub.market_id, v_sub.current_period_end)
      when v_sub.next_price_cents is not null and v_sub.next_price_from <= v_sub.current_period_end then v_sub.next_price_cents
      else v_sub.price_cents end;
    update public.provider_subscriptions
       set plan = v_plan, price_cents = v_price, next_plan = null,
           next_price_cents = case when next_price_from <= current_period_end then null else next_price_cents end,
           next_price_from = case when next_price_from <= current_period_end then null else next_price_from end,
           current_period_start = current_period_end, current_period_end = current_period_end + interval '1 month'
     where id = v_sub.id;
    insert into public.subscription_charges (subscription_id, provider_id, kind, amount_cents, period_start, period_end)
    values (v_sub.id, v_sub.provider_id, 'period', v_price, v_sub.current_period_end,
            v_sub.current_period_end + interval '1 month');
  end loop;

  -- A freed Featured slot goes to the oldest waitlist place in that market.
  for v_next in
    select w.id, w.provider_id, w.market_id from public.provider_subscriptions w
     where w.plan = 'featured' and w.status = 'waitlist'
       and (select count(*) from public.provider_subscriptions s
             where s.plan = 'featured' and s.status = 'active' and s.market_id = w.market_id)
           < coalesce((select fs.slots from public.featured_settings fs where fs.market_id = w.market_id), 3)
       and w.id = (select w2.id from public.provider_subscriptions w2
                    where w2.plan = 'featured' and w2.status = 'waitlist' and w2.market_id = w.market_id
                    order by w2.created_at limit 1)
  loop
    v_price := public.plan_price('featured', v_next.market_id, p_now);
    update public.provider_subscriptions
       set status = 'active', price_cents = v_price, current_period_start = p_now,
           current_period_end = p_now + interval '1 month'
     where id = v_next.id;
    insert into public.subscription_charges (subscription_id, provider_id, kind, amount_cents, period_start, period_end)
    values (v_next.id, v_next.provider_id, 'period', v_price, p_now, p_now + interval '1 month');
  end loop;
  return v_n;
end;
$$;
revoke all on function public.run_plan_renewals(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'plan-renewals') then
    perform cron.unschedule('plan-renewals');
  end if;
  perform cron.schedule('plan-renewals', '7 5 * * *', 'select public.run_plan_renewals()');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin: catalog, prices (with notice and grandfathering), Featured settings, offers, assignment
-- ---------------------------------------------------------------------------------------------
create function public.set_plan_catalog(
  p_plan text, p_name text, p_fee_discount_bps integer, p_first_look_seconds integer,
  p_technician_limit integer, p_insights_level text, p_auto_topup boolean, p_active boolean,
  p_sort_order integer, p_bullets jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'ops_manager') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_plan = 'basic' and not p_active then
    raise exception 'Basic is the minimum plan and stays available' using errcode = '22023';
  end if;
  update public.plan_catalog
     set name = p_name, fee_discount_bps = p_fee_discount_bps, first_look_seconds = p_first_look_seconds,
         technician_limit = p_technician_limit, insights_level = p_insights_level, auto_topup = p_auto_topup,
         active = p_active, sort_order = p_sort_order, bullets = p_bullets, updated_at = now(), updated_by = auth.uid()
   where plan = p_plan;
  if not found then raise exception 'unknown plan' using errcode = '22023'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'plan.catalog', 'plan', p_plan,
          jsonb_build_object('fee_discount_bps', p_fee_discount_bps, 'first_look_seconds', p_first_look_seconds,
                             'technician_limit', p_technician_limit, 'active', p_active));
end;
$$;
revoke all on function public.set_plan_catalog(text, text, integer, integer, integer, text, boolean, boolean, integer, jsonb) from public, anon;
grant execute on function public.set_plan_catalog(text, text, integer, integer, integer, text, boolean, boolean, integer, jsonb) to authenticated;

-- A new price from p_effective_from for one market (or every market without its own price).
-- New subscribers pay it from that date. Existing subscribers of that plan and market keep their
-- price (p_grandfather) or move to it on their first billing date at least p_notice_days away.
-- p_dry_run returns who is affected without changing anything (the admin preview).
create function public.set_plan_price(
  p_plan text, p_market_id uuid, p_price_cents integer, p_effective_from timestamptz,
  p_grandfather boolean, p_notice_days integer default 30, p_dry_run boolean default false)
returns table (subscription_id uuid, provider_id uuid, provider_name text, current_cents integer,
               new_cents integer, applies_from timestamptz, grandfathered boolean)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'ops_manager')
     or (p_market_id is not null and not public.staff_can_access_market(p_market_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_plan = 'basic' and p_price_cents < 2000 then
    raise exception 'Basic costs at least 20 USD a month' using errcode = '22023';
  end if;
  if p_effective_from < now() - interval '1 minute' then
    raise exception 'the new price cannot start in the past' using errcode = '22023';
  end if;

  return query
  with affected as (
    select s.id, s.provider_id, p.name, s.price_cents, s.current_period_end
    from public.provider_subscriptions s
    join public.providers p on p.id = s.provider_id
    where s.plan = p_plan and s.status = 'active'
      and (s.market_id = p_market_id
           or (p_market_id is null and not exists (select 1 from public.plan_prices pp
                                                    where pp.plan = p_plan and pp.market_id = s.market_id)))
  )
  select a.id, a.provider_id, a.name, a.price_cents,
         case when p_grandfather then a.price_cents else p_price_cents end,
         case when p_grandfather then null::timestamptz else (
           -- The first billing date on or after both the effective date and the notice period.
           select min(a.current_period_end + make_interval(months => i)) from generate_series(0, 24) i
           where a.current_period_end + make_interval(months => i) >= greatest(p_effective_from,
                                                                              now() + make_interval(days => p_notice_days))) end,
         p_grandfather
  from affected a
  order by a.name;

  if p_dry_run then return; end if;

  insert into public.plan_prices (plan, market_id, price_cents, effective_from, grandfather, notice_days, created_by)
  values (p_plan, p_market_id, p_price_cents, p_effective_from, p_grandfather, p_notice_days, auth.uid());

  update public.provider_subscriptions s
     set grandfathered = case when p_grandfather then true else false end,
         next_price_cents = case when p_grandfather then null else p_price_cents end,
         next_price_from = case when p_grandfather then null else (
           select min(s.current_period_end + make_interval(months => i)) from generate_series(0, 24) i
           where s.current_period_end + make_interval(months => i) >= greatest(p_effective_from,
                                                                              now() + make_interval(days => p_notice_days))) end
   where s.plan = p_plan and s.status = 'active'
     and (s.market_id = p_market_id
          or (p_market_id is null and not exists (select 1 from public.plan_prices pp
                                                   where pp.plan = p_plan and pp.market_id = s.market_id)));

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'plan.price', 'plan', p_plan, p_market_id,
          jsonb_build_object('price_cents', p_price_cents, 'effective_from', p_effective_from,
                             'grandfather', p_grandfather, 'notice_days', p_notice_days));
end;
$$;
revoke all on function public.set_plan_price(text, uuid, integer, timestamptz, boolean, integer, boolean) from public, anon;
grant execute on function public.set_plan_price(text, uuid, integer, timestamptz, boolean, integer, boolean) to authenticated;

create function public.set_featured_settings(p_market_id uuid, p_slots integer, p_price_rule_pct integer,
                                             p_eta_rule_minutes integer, p_service_slots boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'ops_manager') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.featured_settings (market_id, slots, price_rule_pct, eta_rule_minutes, service_slots, updated_by)
  values (p_market_id, p_slots, p_price_rule_pct, p_eta_rule_minutes, p_service_slots, auth.uid())
  on conflict (market_id) do update
    set slots = excluded.slots, price_rule_pct = excluded.price_rule_pct, eta_rule_minutes = excluded.eta_rule_minutes,
        service_slots = excluded.service_slots, updated_at = now(), updated_by = auth.uid();
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'plan.featured_settings', 'market', p_market_id::text, p_market_id,
          jsonb_build_object('slots', p_slots, 'price_rule_pct', p_price_rule_pct, 'eta_rule_minutes', p_eta_rule_minutes,
                             'service_slots', p_service_slots));
end;
$$;
revoke all on function public.set_featured_settings(uuid, integer, integer, integer, boolean) from public, anon;
grant execute on function public.set_featured_settings(uuid, integer, integer, integer, boolean) to authenticated;

create function public.set_plan_offer(p_market_id uuid, p_plan text, p_first_month_cents integer,
                                      p_ends_at timestamptz, p_active boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'ops_manager') or not public.staff_can_access_market(p_market_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.plan_offers (market_id, plan, first_month_cents, ends_at, active)
  values (p_market_id, p_plan, p_first_month_cents, p_ends_at, p_active)
  on conflict (market_id, plan) do update
    set first_month_cents = excluded.first_month_cents, ends_at = excluded.ends_at, active = excluded.active,
        updated_at = now();
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'plan.offer', 'market', p_market_id::text, p_market_id,
          jsonb_build_object('plan', p_plan, 'first_month_cents', p_first_month_cents, 'ends_at', p_ends_at,
                             'active', p_active));
end;
$$;
revoke all on function public.set_plan_offer(uuid, text, integer, timestamptz, boolean) from public, anon;
grant execute on function public.set_plan_offer(uuid, text, integer, timestamptz, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Offers need a plan; Pro gets a first look; the job fee follows the plan
-- ---------------------------------------------------------------------------------------------
-- Seconds before this provider may see a new request: 0 for Pro, and 0 for everyone when no Pro
-- provider is in range; otherwise the Pro first-look window. (Instant book offers above the
-- customer's price limit never wait: the caller passes p_instant_above_limit.)
create function public.offer_delay_seconds(p_provider_id uuid, p_any_pro_in_range boolean,
                                           p_instant_above_limit boolean default false)
returns integer
language sql stable security definer set search_path = '' as $$
  select case
    when p_instant_above_limit or not p_any_pro_in_range or public.provider_plan(p_provider_id) = 'pro' then 0
    else coalesce((select c.first_look_seconds from public.plan_catalog c where c.plan = 'pro' and c.active), 0)
  end;
$$;
revoke all on function public.offer_delay_seconds(uuid, boolean, boolean) from public, anon;
grant execute on function public.offer_delay_seconds(uuid, boolean, boolean) to authenticated;

drop function public.nearby_providers(uuid);
create function public.nearby_providers(p_request_id uuid)
returns table (provider_id uuid, name text, dispatch_phone text, distance_miles numeric,
               in_radius boolean, price_cents integer, last_response_sec integer, acceptance_rate numeric,
               plan text, offer_delay_sec integer)
language sql stable security invoker set search_path = '' as $$
  with r as (select id, market_id, service_id, pickup_point from public.requests where id = p_request_id),
  base as (
    select p.id, p.name, p.dispatch_phone::text as phone,
           case when r.pickup_point is null or p.base_point is null then null
                else round((extensions.st_distance(p.base_point, r.pickup_point) / 1609.344)::numeric, 1) end as dist,
           case when r.pickup_point is null or p.base_point is null or p.service_radius_miles is null then null
                else extensions.st_dwithin(p.base_point, r.pickup_point, p.service_radius_miles * 1609.344) end as in_radius,
           sp.price_cents,
           public.provider_plan(p.id) as plan
    from r
    join public.providers p on p.status = 'active' and not p.is_demo and r.market_id = any (p.market_ids)
    left join public.provider_service_prices sp
      on sp.provider_id = p.id and sp.market_id = r.market_id and sp.service_id = r.service_id and sp.active
    where r.service_id is null or sp.provider_id is not null
  )
  select b.id, b.name, b.phone, b.dist, b.in_radius, b.price_cents,
         (select a.response_sec from public.dispatch_attempts a
           where a.provider_id = b.id and a.response_sec is not null order by a.created_at desc limit 1),
         (select round(count(*) filter (where a.outcome in ('quoted', 'assigned'))::numeric / nullif(count(*), 0), 2)
            from public.dispatch_attempts a where a.provider_id = b.id),
         b.plan,
         public.offer_delay_seconds(b.id, exists (select 1 from base x where x.plan = 'pro' and x.in_radius is not false))
  from base b
  -- No free plan: providers without an active Basic or Pro plan receive no requests (RSOS-114).
  where b.plan is not null
  order by 10, 4 nulls last, 2;
$$;
revoke all on function public.nearby_providers(uuid) from public, anon;
grant execute on function public.nearby_providers(uuid) to authenticated;

-- The job fee is discounted while the provider is on Pro.
create or replace function public.record_manual_test_fee(p_provider_id uuid, p_amount_cents integer, p_request_id uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fee integer;
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
  if v_fee > 0 and not exists (
    select 1 from public.wallet_ledger l where l.request_id = p_request_id and l.kind in ('fee', 'bonus_use')
      and l.provider_id = p_provider_id
  ) then
    perform public.charge_wallet(p_provider_id, v_fee, p_request_id, 'fee');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reporting: subscribers and MRR (staff), Featured providers for the city page (public)
-- ---------------------------------------------------------------------------------------------
create function public.plan_subscribers()
returns table (subscription_id uuid, provider_id uuid, provider_name text, plan text, market_id uuid,
               market_name text, service_id uuid, status text, started_at timestamptz, price_cents integer,
               grandfathered boolean, next_price_cents integer, next_price_from timestamptz, next_plan text,
               cancel_at_period_end boolean, current_period_end timestamptz)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.provider_id, p.name, s.plan, s.market_id, m.name, s.service_id, s.status, s.started_at,
         s.price_cents, s.grandfathered, s.next_price_cents, s.next_price_from, s.next_plan,
         s.cancel_at_period_end, s.current_period_end
  from public.provider_subscriptions s
  join public.providers p on p.id = s.provider_id
  join public.markets m on m.id = s.market_id
  where s.status in ('active', 'waitlist')
  order by m.name, s.plan, p.name;
$$;
revoke all on function public.plan_subscribers() from public, anon;
grant execute on function public.plan_subscribers() to authenticated;

-- Featured providers in a market, for the city page list (names only).
create function public.featured_providers(p_market_slug text)
returns table (provider_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name
  from public.provider_subscriptions s
  join public.providers p on p.id = s.provider_id and p.status = 'active' and not p.is_demo
  join public.markets m on m.id = s.market_id and m.slug = p_market_slug and m.status in ('test', 'active')
  where s.plan = 'featured' and s.status = 'active'
  order by s.started_at;
$$;
revoke all on function public.featured_providers(text) from public;
grant execute on function public.featured_providers(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Launch: providers already active keep receiving requests on Basic at the launch price.
-- ---------------------------------------------------------------------------------------------
insert into public.provider_subscriptions (provider_id, plan, market_id, price_cents)
select p.id, 'basic', p.market_ids[1], public.plan_price('basic', p.market_ids[1])
from public.providers p
where p.status = 'active' and not p.is_demo and cardinality(p.market_ids) > 0
on conflict do nothing;
