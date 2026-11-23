-- RSOS-108: the website's speed promise ("Typical time to book in <city>: 4 min") comes only from
-- real bookings: the median time from a request being sent to a provider being booked, over the
-- last 30 days. Fewer than 10 bookings: no number (the website hides the line). Aggregates only,
-- so it is safe for visitors; fictional test numbers and test-cleanup requests never count.
create function public.market_booking_speed(p_market_slug text)
returns table (bookings integer, median_minutes integer)
language sql stable security definer set search_path = '' as $$
  with m as (select id from public.markets where slug = p_market_slug::extensions.citext and status in ('test', 'active')),
  booked as (
    select extract(epoch from (r.accepted_at - coalesce(r.submitted_at, r.created_at))) / 60 as minutes
    from public.requests r join m on r.market_id = m.id
    where r.accepted_at is not null
      and r.accepted_at >= coalesce(r.submitted_at, r.created_at)
      and r.created_at > now() - interval '30 days'
      and r.driver_phone !~ '^\+1[0-9]{3}55501[0-9]{2}$'
      and coalesce(r.end_reason, '') <> 'test cleanup'
  )
  select count(*)::int,
         case when count(*) >= 10 then greatest(1, round(percentile_cont(0.5) within group (order by minutes)))::int end
  from booked;
$$;
revoke all on function public.market_booking_speed(text) from public;
grant execute on function public.market_booking_speed(text) to anon, authenticated;
