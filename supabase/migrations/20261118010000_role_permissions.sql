-- RSOS-102: the database enforces the roles defined in Admin > Team & roles (labels in the app;
-- enum names unchanged). Dispatchers read providers but no longer edit them or see fee rows;
-- provider success (support) edits providers' dispatch details and prices; fee rows are for
-- owners, operations managers, finance and viewers.

drop policy "operations edit provider dispatch details" on public.providers;
create policy "operations and provider success edit provider details" on public.providers for update to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'));

drop policy "operations edit provider prices" on public.provider_service_prices;
create policy "operations and provider success edit provider prices" on public.provider_service_prices for all to authenticated
  using (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'))
  with check (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'support'));

drop policy "finance and operations read fee rows" on public.provider_billing_events;
create policy "owners, operations, finance and viewers read fee rows" on public.provider_billing_events for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'finance', 'read_only'));

-- Demo sign-in offers every role on staging and previews (never production).
alter table public.demo_accounts drop constraint demo_accounts_role_check;
alter table public.demo_accounts add constraint demo_accounts_role_check check (role in (
  'provider_owner', 'provider_manager', 'provider_operator',
  'admin_super', 'admin_ops', 'admin_dispatcher', 'admin_success', 'admin_finance', 'admin_marketing', 'admin_viewer'));
