-- Code review 2026-11-20: staff-only functions guarded with
--   if public.jwt_staff_role() not in ('super_admin', ...) then raise ...
-- let every signed-in non-staff user through. jwt_staff_role() is NULL for providers and customer
-- accounts, `NULL not in (...)` is NULL, and IF NULL does not raise. Affected (all granted to
-- authenticated): dispatch_step, record_manual_test_fee, refund_job_fee, set_provider_status,
-- create_provider_from_application, clear_review_flag, set_provider_identifier,
-- add_test_traffic_rule, remove_test_traffic_rule, set_ad_connection, map_ad_campaign,
-- set_question_override. Guards combined with `or not staff_can_access_market(...)` were already
-- safe, but they are rewritten the same way so the pattern is gone everywhere.

-- 1. A NULL-safe check for new code: `if not public.staff_role_in('super_admin', 'ops_manager')`.
create function public.staff_role_in(variadic p_roles text[]) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.jwt_staff_role()::text = any (p_roles), false);
$$;
revoke all on function public.staff_role_in(text[]) from public, anon;
grant execute on function public.staff_role_in(text[]) to authenticated;

-- 2. Rewrite the existing guards in place: compare a non-NULL text instead of the nullable role.
--    The function bodies are otherwise unchanged (pg_get_functiondef keeps the source as written,
--    and CREATE OR REPLACE keeps owners and grants).
do $$
declare
  f record;
  v_def text;
  v_new text;
  v_count integer := 0;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and (p.prosrc like '%public.jwt_staff_role() not in (%' or p.prosrc like '%public.jwt_staff_role() <> ''%')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_new := replace(v_def, 'public.jwt_staff_role() not in (', 'coalesce(public.jwt_staff_role()::text, '''') not in (');
    v_new := replace(v_new, 'public.jwt_staff_role() <> ''', 'coalesce(public.jwt_staff_role()::text, '''') <> ''');
    execute v_new;
    v_count := v_count + 1;
  end loop;
  if v_count < 12 then
    raise exception 'expected to rewrite at least 12 guarded functions, rewrote %', v_count;
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.prosrc like '%public.jwt_staff_role() not in (%' or p.prosrc like '%public.jwt_staff_role() <> ''%')
  ) then
    raise exception 'a NULL-unsafe staff guard is still present';
  end if;
end;
$$;

-- 3. Assigning the same provider twice no longer records the test fee twice (Test campaign sums
--    these events); the wallet charge was already once per request.
create or replace function public.record_manual_test_fee(p_provider_id uuid, p_amount_cents integer, p_request_id uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.staff_role_in('super_admin', 'ops_manager', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.provider_billing_events b
              where b.request_id = p_request_id and b.provider_id = p_provider_id and b.kind = 'manual_test') then
    return;
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

-- 4. The website asks once per few minutes whether the test list has any IP rules at all, and only
--    then checks each visitor's IP (it used to query the database for every new visitor IP before
--    the page rendered, including on the emergency Get Help path).
create function public.test_traffic_has_ip_rules() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.test_traffic_rules where kind = 'ip');
$$;
revoke all on function public.test_traffic_has_ip_rules() from public;
grant execute on function public.test_traffic_has_ip_rules() to anon, authenticated;
