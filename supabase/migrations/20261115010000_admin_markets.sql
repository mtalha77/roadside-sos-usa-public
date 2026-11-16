-- Batch 3 (RSOS-077): market shapes for the admin markets screen. Security invoker: the staff
-- "read markets" policy decides access; anonymous visitors cannot call it.
create or replace function public.admin_market_shapes()
returns table (slug text, center_lat double precision, center_lng double precision, boundary jsonb)
language sql stable security invoker set search_path = '' as $$
  select m.slug::text,
         extensions.st_y(m.center::extensions.geometry),
         extensions.st_x(m.center::extensions.geometry),
         case when m.boundary is null then null
              else extensions.st_asgeojson(extensions.st_simplify(m.boundary::extensions.geometry, 0.002))::jsonb end
  from public.markets m
  order by m.name;
$$;
revoke all on function public.admin_market_shapes() from public, anon;
grant execute on function public.admin_market_shapes() to authenticated;
