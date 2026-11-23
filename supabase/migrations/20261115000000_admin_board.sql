-- Batch 3 (RSOS-034 + 072): live requests for the dispatch board, with coordinates. Security
-- invoker, so the staff "read requests in their markets" policy still decides what each person sees.
create or replace function public.admin_live_requests(p_since timestamptz default now() - interval '30 minutes')
returns table (
  id uuid, short_code text, status public.request_status, channel public.request_channel,
  market_slug text, service_slug text, driver_name text, driver_phone text,
  pickup_address text, lat double precision, lng double precision,
  created_at timestamptz, submitted_at timestamptz, quoted_at timestamptz, accepted_at timestamptz,
  en_route_at timestamptz, on_site_at timestamptz, status_token text
)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.short_code, r.status, r.channel, m.slug::text, s.slug::text, r.driver_name, r.driver_phone,
         r.pickup_address,
         extensions.st_y(r.pickup_point::extensions.geometry), extensions.st_x(r.pickup_point::extensions.geometry),
         r.created_at, r.submitted_at, r.quoted_at, r.accepted_at, r.en_route_at, r.on_site_at, r.status_token
  from public.requests r
  join public.markets m on m.id = r.market_id
  join public.services s on s.id = r.service_id
  where r.status in ('submitted', 'quoting', 'quoted', 'accepted', 'en_route', 'on_site')
     or r.updated_at > p_since
  order by r.created_at desc
  limit 500;
$$;
revoke all on function public.admin_live_requests(timestamptz) from public, anon;
grant execute on function public.admin_live_requests(timestamptz) to authenticated;
