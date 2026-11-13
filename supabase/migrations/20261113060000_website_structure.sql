-- RSOS-019: what the public website needs to build its pages, menus and market detection from the
-- database. Anonymous visitors still never read tables directly: only these definer functions.

-- Every service with its price range across published markets and the number of published markets
-- offering it (0 = not available yet: the page says so, menus hide it).
create function public.list_public_services()
returns table (slug text, name text, description text, icon_key text, needs_destination boolean, sort_order integer,
               price_min_cents integer, price_max_cents integer, market_count integer)
language sql stable security definer set search_path = '' as $$
  select s.slug::text, s.name, s.description, s.icon_key, s.needs_destination, s.sort_order,
         min(cms.price_min_cents) filter (where m.id is not null)::int,
         max(cms.price_max_cents) filter (where m.id is not null)::int,
         count(distinct m.id)::int
  from public.services s
  left join public.current_market_services cms on cms.service_id = s.id and cms.enabled
  left join public.markets m on m.id = cms.market_id and m.status in ('test', 'active')
  group by s.id
  order by s.sort_order, s.name;
$$;

-- The number the website shows for a market: its active "website" tracking number, else the
-- market's support line. Null until the owner buys numbers (then call buttons appear).
create function public.market_website_phone(p_market_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.phone_number::text from public.market_phone_numbers p
      where p.market_id = p_market_id and p.purpose = 'website' and p.is_active
      order by p.created_at limit 1),
    (select m.support_phone::text from public.markets m where m.id = p_market_id));
$$;

-- Published markets with their website number (menus, footer, header tap-to-call).
create function public.list_site_markets()
returns table (id uuid, slug text, name text, state_code text, time_zone text, status public.market_status, phone text,
               center_lat double precision, center_lng double precision)
language sql stable security definer set search_path = '' as $$
  select m.id, m.slug::text, m.name, m.state_code::text, m.time_zone, m.status, public.market_website_phone(m.id),
         extensions.st_y(m.center::extensions.geometry), extensions.st_x(m.center::extensions.geometry)
  from public.markets m
  where m.status in ('test', 'active')
  order by m.name;
$$;

-- Live proof for a market, only from real data: verified active providers and the average minutes
-- from acceptance to arrival over the last 90 days (null below 10 completed jobs, never invented).
create function public.market_public_stats(p_market_slug text)
returns table (provider_count integer, avg_eta_minutes integer, completed_jobs integer)
language sql stable security definer set search_path = '' as $$
  with m as (select id from public.markets where slug = p_market_slug::extensions.citext and status in ('test', 'active')),
  jobs as (
    select extract(epoch from (r.on_site_at - r.accepted_at)) / 60 as minutes
    from public.requests r join m on r.market_id = m.id
    where r.status = 'completed' and r.accepted_at is not null and r.on_site_at > r.accepted_at
      and r.completed_at > now() - interval '90 days'
  )
  select (select count(*)::int from public.providers p, m where p.status = 'active' and m.id = any (p.market_ids)),
         (select case when count(*) >= 10 then round(avg(minutes))::int end from jobs),
         (select count(*)::int from jobs)
  from m;
$$;

-- Waitlist for visitors outside every market. Validated here as well as in the app.
create function public.join_waitlist(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_email text := nullif(trim(p ->> 'email'), '');
  v_zip text := nullif(trim(p ->> 'zip'), '');
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_zip is not null and v_zip !~ '^[0-9]{5}$' then raise exception 'invalid zip' using errcode = '22023'; end if;
  insert into public.waitlist (email, zip, city, state_code, point, source)
  values (
    v_email, v_zip,
    left(nullif(p ->> 'city', ''), 120),
    case when (p ->> 'state_code') ~ '^[A-Z]{2}$' then p ->> 'state_code' end,
    case when (p ->> 'lat') is not null and (p ->> 'lng') is not null
         then extensions.st_setsrid(extensions.st_makepoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::extensions.geography end,
    left(coalesce(nullif(p ->> 'source', ''), 'website'), 60));
end;
$$;

revoke execute on function public.list_public_services(), public.market_website_phone(uuid), public.list_site_markets(),
  public.market_public_stats(text), public.join_waitlist(jsonb) from public;
grant execute on function public.list_public_services(), public.list_site_markets(), public.market_public_stats(text),
  public.join_waitlist(jsonb) to anon, authenticated;
