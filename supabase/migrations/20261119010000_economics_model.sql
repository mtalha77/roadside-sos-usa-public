-- RSOS-113: the economics model, per market and scenario (base, strong), editable by owners and
-- operations managers in Admin > Business > Economics model, with a change history. Analytics
-- reads it for the Model view and the "vs model" lines. Seeded from the owner's brief (Nov 2026).
create table public.economics_models (
  market_id uuid not null references public.markets (id) on delete cascade,
  scenario text not null check (scenario in ('base', 'strong')),
  -- Validated by the app (packages/core/src/economics.ts); the database checks the shape.
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object' and pg_column_size(inputs) < 8192),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (market_id, scenario)
);
alter table public.economics_models enable row level security;
create policy "analytics roles read the economics model" on public.economics_models for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance', 'marketing', 'read_only')
         and public.staff_can_access_market(market_id));
create policy "owners and operations edit the economics model" on public.economics_models for insert to authenticated
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager') and public.staff_can_access_market(market_id));
create policy "owners and operations update the economics model" on public.economics_models for update to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager') and public.staff_can_access_market(market_id))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager') and public.staff_can_access_market(market_id));

-- Who changed what, when: one append-only row per saved version, written by a trigger.
create table public.economics_model_history (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id) on delete cascade,
  scenario text not null,
  inputs jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index economics_model_history_market_idx on public.economics_model_history (market_id, changed_at desc);
alter table public.economics_model_history enable row level security;
create policy "owners and operations read model history" on public.economics_model_history for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager') and public.staff_can_access_market(market_id));
create trigger economics_model_history_append_only before update or delete on public.economics_model_history
  for each row execute function public.forbid_change();

create function public.record_economics_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  insert into public.economics_model_history (market_id, scenario, inputs, changed_by)
  values (new.market_id, new.scenario, new.inputs, new.updated_by);
  return new;
end;
$$;
revoke all on function public.record_economics_change() from public, anon, authenticated;
create trigger economics_models_history before insert or update on public.economics_models
  for each row execute function public.record_economics_change();

-- Seed: the brief's inputs for the launch markets (market data, stored as rows).
insert into public.economics_models (market_id, scenario, inputs)
select m.id, v.scenario, jsonb_build_object(
  'monthlyBudget', 4000,
  'costPerClick', v.cpc,
  'clickToRequest', v.ctr,
  'acceptance', v.acc,
  'serviceMix', jsonb_build_object('tow', 0.48, 'wont-start', 0.26, 'flat-tire', 0.12, 'locked-out', 0.08, 'out-of-gas', 0.06),
  'feeByService', jsonb_build_object('tow', 42.5, 'locked-out', 27.5, 'wont-start', 22.5, 'flat-tire', 22.5, 'out-of-gas', 22.5),
  'paymentFeeShare', 0.08,
  'subscriptionsNet', 900,
  'fixedCosts', 3500,
  -- Not in the brief (labelled as assumptions in the admin): only shape the Model and Demo funnels.
  'startToSubmit', 0.6,
  'quoteRate', 0.9,
  'completionRate', 0.9)
from (values
  ('san-antonio', 'base', 4.25, 0.25, 0.7), ('san-antonio', 'strong', 2.42, 0.30, 0.8),
  ('las-vegas', 'base', 4.87, 0.25, 0.7), ('las-vegas', 'strong', 1.99, 0.30, 0.8),
  ('houston', 'base', 5.95, 0.25, 0.7), ('houston', 'strong', 2.70, 0.30, 0.8)
) as v(slug, scenario, cpc, ctr, acc)
join public.markets m on m.slug = v.slug
on conflict (market_id, scenario) do nothing;

revoke all on public.economics_models, public.economics_model_history from anon;
