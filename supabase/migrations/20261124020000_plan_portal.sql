-- RSOS-114: the provider portal's Plan & billing page needs the markets of the signed-in member's
-- company (providers cannot read the markets table directly).
create function public.my_markets()
returns table (provider_id uuid, market_id uuid, slug text, name text)
language sql stable security definer set search_path = '' as $$
  select p.id, m.id, m.slug::text, m.name
  from public.providers p
  join public.markets m on m.id = any (p.market_ids)
  where public.jwt_provider_role(p.id) is not null
  order by array_position(p.market_ids, m.id);
$$;
revoke all on function public.my_markets() from public, anon;
grant execute on function public.my_markets() to authenticated;

-- The Featured placement rules for a market (the customer quote list applies them).
create function public.featured_rules(p_market_slug text)
returns table (price_rule_pct integer, eta_rule_minutes integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(fs.price_rule_pct, 15), coalesce(fs.eta_rule_minutes, 10)
  from (select 1) x
  left join public.markets m on m.slug = p_market_slug
  left join public.featured_settings fs on fs.market_id = m.id;
$$;
revoke all on function public.featured_rules(text) from public;
grant execute on function public.featured_rules(text) to anon, authenticated;
