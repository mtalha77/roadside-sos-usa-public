-- Batch 3 (RSOS-082): the content manager edits each market's city page intro. Only super admins
-- and operations managers may change it; every change is written to the audit log.
create or replace function public.admin_update_market_intro(p_slug text, p_intro text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_market uuid;
begin
  if coalesce(public.jwt_staff_role()::text, '') not in ('super_admin', 'ops_manager') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_intro is null or length(btrim(p_intro)) < 40 or length(p_intro) > 1200 then
    raise exception 'intro must be 40 to 1200 characters' using errcode = '22023';
  end if;
  update public.markets set seo_intro = btrim(p_intro)
  where slug = p_slug::extensions.citext
  returning id into v_market;
  if v_market is null then raise exception 'unknown market' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role(), 'market.intro_updated', 'market', v_market::text, v_market,
          jsonb_build_object('length', length(btrim(p_intro))));
end;
$$;
revoke all on function public.admin_update_market_intro(text, text) from public, anon;
grant execute on function public.admin_update_market_intro(text, text) to authenticated;
