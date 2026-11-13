-- RSOS-026: provider plans per market (owner's stated ranges until final prices are set) and the
-- public application function. Applications and consents stay unreadable by visitors.

create type public.plan_kind as enum ('pro', 'featured');

-- Append-only like market_services: a change is a new row with a later effective_from.
create table public.market_plans (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  plan public.plan_kind not null,
  price_min_cents integer not null check (price_min_cents >= 0),
  price_max_cents integer not null check (price_max_cents >= price_min_cents),
  -- Discount on the per-request fee, in basis points (1500 = 15%).
  fee_discount_bps integer not null default 0 check (fee_discount_bps between 0 and 10000),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (market_id, plan, effective_from)
);
create trigger market_plans_append_only before update or delete on public.market_plans for each row execute function public.forbid_change();
alter table public.market_plans enable row level security;
revoke all on public.market_plans from anon;
create policy "staff read plans" on public.market_plans for select to authenticated using (public.staff_can_access_market(market_id));
create policy "finance adds plan prices" on public.market_plans for insert to authenticated
  with check (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'finance'));

-- Current plan prices for published markets.
create function public.list_market_plans()
returns table (market_slug text, plan public.plan_kind, price_min_cents integer, price_max_cents integer, fee_discount_bps integer)
language sql stable security definer set search_path = '' as $$
  select distinct on (m.id, p.plan) m.slug::text, p.plan, p.price_min_cents, p.price_max_cents, p.fee_discount_bps
  from public.market_plans p join public.markets m on m.id = p.market_id
  where m.status in ('test', 'active') and p.effective_from <= now()
  order by m.id, p.plan, p.effective_from desc;
$$;

-- The owner's ranges for the test markets: Pro 99 to 149 USD a month with 15% off fees,
-- Featured 25 to 50 USD a month per market. Exact prices per city are an open decision.
insert into public.market_plans (market_id, plan, price_min_cents, price_max_cents, fee_discount_bps, effective_from)
select m.id, v.plan::public.plan_kind, v.min, v.max, v.bps, '2026-11-13T00:00:00Z'
from public.markets m
cross join (values ('pro', 9900, 14900, 1500), ('featured', 2500, 5000, 0)) as v(plan, min, max, bps)
where m.slug in ('san-antonio', 'las-vegas', 'houston')
on conflict do nothing;

-- Public application form. Markets and services are given by slug and stored as ids (the market
-- tag); an SMS opt-in is stored as a consent with the version of the SMS terms that was shown.
create function public.submit_provider_application(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_markets uuid[];
  v_services uuid[];
begin
  if coalesce(length(trim(p ->> 'company_name')), 0) not between 2 and 160 then raise exception 'invalid company' using errcode = '22023'; end if;
  if coalesce(length(trim(p ->> 'contact_name')), 0) not between 2 and 120 then raise exception 'invalid contact' using errcode = '22023'; end if;
  select coalesce(array_agg(m.id), '{}') into v_markets from public.markets m
   where m.slug::text in (select jsonb_array_elements_text(coalesce(p -> 'market_slugs', '[]'))) and m.status in ('test', 'active');
  if cardinality(v_markets) = 0 then raise exception 'choose at least one market' using errcode = '22023'; end if;
  select coalesce(array_agg(s.id), '{}') into v_services from public.services s
   where s.slug::text in (select jsonb_array_elements_text(coalesce(p -> 'service_slugs', '[]')));
  if cardinality(v_services) = 0 then raise exception 'choose at least one service' using errcode = '22023'; end if;
  insert into public.provider_applications (company_name, contact_name, phone, email, market_ids, service_ids, truck_count,
                                            insurance_carrier, license_number, referral_source)
  values (trim(p ->> 'company_name'), trim(p ->> 'contact_name'), p ->> 'phone', trim(p ->> 'email'), v_markets, v_services,
          nullif(p ->> 'truck_count', '')::int, left(nullif(trim(p ->> 'insurance_carrier'), ''), 160),
          left(nullif(trim(p ->> 'license_number'), ''), 60), left(nullif(trim(p ->> 'referral_source'), ''), 160))
  returning id into v_id;
  if (p ->> 'sms_consent')::boolean is true then
    if coalesce(p ->> 'sms_policy_version', '') = '' then raise exception 'policy version required' using errcode = '22023'; end if;
    insert into public.consents (phone, consent_type, granted, policy_version, ip, user_agent, source)
    values (p ->> 'phone', 'sms_transactional', true, p ->> 'sms_policy_version',
            nullif(p ->> 'ip', '')::inet, left(p ->> 'user_agent', 300), 'provider_application');
  end if;
  return v_id;
end;
$$;

revoke execute on function public.list_market_plans(), public.submit_provider_application(jsonb) from public;
grant execute on function public.list_market_plans(), public.submit_provider_application(jsonb) to anon, authenticated;
