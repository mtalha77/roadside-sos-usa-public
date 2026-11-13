-- RSOS-018: authentication and roles.
-- Staff (admin app) and provider members (provider app) are rows linked to auth.users. A custom
-- access token hook copies their role into the JWT, so policies check claims without extra queries.
-- Staff policies also require aal2 (authenticator app second step), so a password alone reads nothing.

create type public.staff_role as enum ('super_admin', 'ops_manager', 'dispatcher', 'support', 'finance', 'marketing', 'read_only');
create type public.provider_role as enum ('owner', 'manager', 'operator');
create type public.provider_status as enum ('applied', 'onboarding', 'active', 'paused', 'suspended', 'closed');

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  -- Null = all markets. Otherwise the staff member only sees these markets.
  market_ids uuid[],
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_members_updated_at before update on public.staff_members for each row execute function public.set_updated_at();

-- Provider companies. Profile, coverage and verification fields arrive with the provider tickets.
create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.provider_status not null default 'applied',
  market_ids uuid[] not null default '{}',
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger providers_updated_at before update on public.providers for each row execute function public.set_updated_at();

create table public.provider_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  role public.provider_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);
create index provider_members_provider_idx on public.provider_members (provider_id);

-- Billing stubs (wallet and statements arrive with the wallet tickets). Owners and managers only.
create table public.provider_wallets (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  balance_cents integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.provider_billing_events (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);
create trigger provider_billing_events_append_only before update or delete on public.provider_billing_events for each row execute function public.forbid_change();

do $$
declare t text;
begin
  foreach t in array array['staff_members', 'providers', 'provider_members', 'provider_wallets', 'provider_billing_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Custom access token hook: adds app_role, staff_role, staff_markets, provider memberships.
-- Registered on each project by scripts/supabase-auth-config.sh (hook_custom_access_token_*).
-- ---------------------------------------------------------------------------------------------
create function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := event -> 'claims';
  uid uuid := (event ->> 'user_id')::uuid;
  staff public.staff_members%rowtype;
  memberships jsonb;
begin
  select * into staff from public.staff_members s where s.user_id = uid and s.is_active;
  select coalesce(jsonb_agg(jsonb_build_object('provider_id', pm.provider_id, 'role', pm.role)), '[]'::jsonb)
    into memberships from public.provider_members pm where pm.user_id = uid;

  claims := claims - 'app_role' - 'staff_role' - 'staff_markets' - 'providers';
  if staff.user_id is not null then
    claims := claims || jsonb_build_object('app_role', 'staff', 'staff_role', staff.role,
                                           'staff_markets', coalesce(to_jsonb(staff.market_ids), 'null'::jsonb));
  elsif jsonb_array_length(memberships) > 0 then
    claims := claims || jsonb_build_object('app_role', 'provider', 'providers', memberships);
  else
    claims := claims || jsonb_build_object('app_role', 'driver');
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.staff_members, public.provider_members to supabase_auth_admin;
create policy "auth hook reads staff" on public.staff_members for select to supabase_auth_admin using (true);
create policy "auth hook reads provider members" on public.provider_members for select to supabase_auth_admin using (true);

-- ---------------------------------------------------------------------------------------------
-- Claim helpers for policies (read the JWT; no table lookups)
-- ---------------------------------------------------------------------------------------------
create function public.jwt_staff_role() returns public.staff_role
language sql stable set search_path = '' as $$
  select case
    when (auth.jwt() ->> 'app_role') = 'staff' and (auth.jwt() ->> 'aal') = 'aal2'
    then (auth.jwt() ->> 'staff_role')::public.staff_role
  end;
$$;

-- True when the signed-in staff member (with aal2) may see this market.
create function public.staff_can_access_market(p_market_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_staff_role() is not null
     and (jsonb_typeof(auth.jwt() -> 'staff_markets') is distinct from 'array'
          or (auth.jwt() -> 'staff_markets') ? p_market_id::text);
$$;

create function public.jwt_provider_role(p_provider_id uuid) returns public.provider_role
language sql stable set search_path = '' as $$
  select (m ->> 'role')::public.provider_role
  from jsonb_array_elements(coalesce(auth.jwt() -> 'providers', '[]'::jsonb)) m
  where (m ->> 'provider_id')::uuid = p_provider_id
  limit 1;
$$;

grant execute on function public.jwt_staff_role(), public.staff_can_access_market(uuid), public.jwt_provider_role(uuid) to authenticated;
revoke execute on function public.jwt_staff_role(), public.staff_can_access_market(uuid), public.jwt_provider_role(uuid) from anon, public;

-- ---------------------------------------------------------------------------------------------
-- Staff policies (aal2 enforced through jwt_staff_role)
-- ---------------------------------------------------------------------------------------------
create policy "staff read markets" on public.markets for select to authenticated using (public.jwt_staff_role() is not null);
create policy "staff read phone numbers" on public.market_phone_numbers for select to authenticated using (public.staff_can_access_market(market_id));
create policy "staff read services" on public.services for select to authenticated using (public.jwt_staff_role() is not null);
create policy "staff read market services" on public.market_services for select to authenticated using (public.staff_can_access_market(market_id));

create policy "staff read requests in their markets" on public.requests for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "operations update requests in their markets" on public.requests for update to authenticated
  using (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'dispatcher'))
  with check (public.staff_can_access_market(market_id));
create policy "staff read request events" on public.request_events for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and public.staff_can_access_market(r.market_id)));
create policy "staff read attributions" on public.attributions for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'read_only')
         and exists (select 1 from public.requests r where r.id = request_id and public.staff_can_access_market(r.market_id)));
create policy "staff read consents" on public.consents for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'));
create policy "staff read applications" on public.provider_applications for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support', 'read_only'));
create policy "staff read contact messages" on public.contact_messages for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'));
create policy "staff read waitlist" on public.waitlist for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));
create policy "super admins read the audit log" on public.audit_log for select to authenticated
  using (public.jwt_staff_role() = 'super_admin');

create policy "staff read staff" on public.staff_members for select to authenticated
  using (user_id = auth.uid() or public.jwt_staff_role() = 'super_admin');
create policy "super admins manage staff" on public.staff_members for all to authenticated
  using (public.jwt_staff_role() = 'super_admin') with check (public.jwt_staff_role() = 'super_admin');

create policy "staff read providers" on public.providers for select to authenticated using (public.jwt_staff_role() is not null);
create policy "finance reads wallets" on public.provider_wallets for select to authenticated using (public.jwt_staff_role() in ('super_admin', 'finance'));
create policy "finance reads billing" on public.provider_billing_events for select to authenticated using (public.jwt_staff_role() in ('super_admin', 'finance'));

-- ---------------------------------------------------------------------------------------------
-- Provider member policies: members see their company; only owners and managers see money.
-- ---------------------------------------------------------------------------------------------
create policy "members read their provider" on public.providers for select to authenticated
  using (public.jwt_provider_role(id) is not null);
create policy "members read their team" on public.provider_members for select to authenticated
  using (public.jwt_provider_role(provider_id) is not null);
create policy "owners and managers read the wallet" on public.provider_wallets for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));
create policy "owners and managers read billing" on public.provider_billing_events for select to authenticated
  using (public.jwt_provider_role(provider_id) in ('owner', 'manager'));
