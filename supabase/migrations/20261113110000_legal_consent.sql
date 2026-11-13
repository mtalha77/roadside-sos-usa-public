-- RSOS-028: versioned legal documents; every consent (SMS, terms, call recording, cookies) must
-- point at the exact document version that was shown (foreign key, so it cannot be skipped).

create table public.policy_versions (
  document text not null check (document in ('driver-terms', 'provider-terms', 'privacy', 'sms-terms', 'call-recording', 'cookies', 'accessibility')),
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(-draft)?$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (document, version)
);
alter table public.policy_versions enable row level security;
revoke all on public.policy_versions from anon;
create policy "staff read policy versions" on public.policy_versions for select to authenticated using (public.jwt_staff_role() is not null);
create policy "super admins manage policy versions" on public.policy_versions for all to authenticated
  using (public.jwt_staff_role() = 'super_admin') with check (public.jwt_staff_role() = 'super_admin');

insert into public.policy_versions (document, version)
select d, '2026-11-13-draft'
from unnest(array['driver-terms', 'provider-terms', 'privacy', 'sms-terms', 'call-recording', 'cookies', 'accessibility']) as d
on conflict do nothing;

-- Consents name their document through their type; the pair must exist in policy_versions.
alter table public.consents add column policy_document text generated always as (
  case consent_type
    when 'terms' then 'driver-terms'
    when 'privacy' then 'privacy'
    when 'sms_transactional' then 'sms-terms'
    when 'sms_marketing' then 'sms-terms'
    when 'call_recording' then 'call-recording'
  end) stored;
-- NOT VALID: rows written before versioning (development data only) are not rechecked; every
-- new consent is.
alter table public.consents add constraint consents_policy_version_fk
  foreign key (policy_document, policy_version) references public.policy_versions (document, version) not valid;

-- Cookie choices (no personal data: a random browser id, the choices, GPC and the policy version).
create table public.cookie_consents (
  id uuid primary key default gen_random_uuid(),
  browser_id uuid not null,
  analytics boolean not null,
  ads boolean not null,
  gpc boolean not null default false,
  policy_document text not null default 'cookies' check (policy_document = 'cookies'),
  policy_version text not null,
  created_at timestamptz not null default now(),
  foreign key (policy_document, policy_version) references public.policy_versions (document, version),
  -- A Global Privacy Control signal always means no advertising.
  check (not (gpc and ads))
);
create index cookie_consents_browser_idx on public.cookie_consents (browser_id, created_at desc);
create trigger cookie_consents_append_only before update or delete on public.cookie_consents for each row execute function public.forbid_change();
alter table public.cookie_consents enable row level security;
revoke all on public.cookie_consents from anon;
create policy "staff read cookie consents" on public.cookie_consents for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'));

create function public.record_cookie_consent(p jsonb) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.cookie_consents (browser_id, analytics, ads, gpc, policy_version)
  values ((p ->> 'browser_id')::uuid, (p ->> 'analytics')::boolean, (p ->> 'ads')::boolean and not coalesce((p ->> 'gpc')::boolean, false),
          coalesce((p ->> 'gpc')::boolean, false), p ->> 'policy_version');
$$;
revoke execute on function public.record_cookie_consent(jsonb) from public;
grant execute on function public.record_cookie_consent(jsonb) to anon, authenticated;
