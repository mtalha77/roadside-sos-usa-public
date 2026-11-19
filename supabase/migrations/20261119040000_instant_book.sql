-- RSOS-109: Instant book. On the status page the customer either compares quotes (default) or
-- sets the most they will pay and the first provider at or below it is booked. Real requests are
-- dispatched by hand today, so the choice and the ceiling are stored, manual dispatch can never
-- assign above the ceiling, and the outcome is recorded for analytics.
alter table public.requests
  add column booking_mode text not null default 'compare' check (booking_mode in ('compare', 'instant')),
  add column instant_max_cents integer check (instant_max_cents between 500 and 1000000),
  add column booking_outcome text check (booking_outcome in ('booked', 'fell_back', 'cancelled')),
  add constraint requests_instant_needs_ceiling check (booking_mode = 'compare' or instant_max_cents is not null);

-- The customer switches with the request's secret link token, any time before a booking.
create function public.set_booking_mode(p_token text, p_mode text, p_max_cents integer)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v public.requests%rowtype;
begin
  if p_mode not in ('compare', 'instant') then return false; end if;
  if p_mode = 'instant' and (p_max_cents is null or p_max_cents not between 500 and 1000000) then return false; end if;
  select * into v from public.requests where status_token = p_token and length(p_token) >= 24 for update;
  if not found or v.status not in ('submitted', 'quoting', 'quoted', 'contacted', 'location_confirmed') then
    return false;
  end if;
  update public.requests
     set booking_mode = p_mode,
         instant_max_cents = case when p_mode = 'instant' then p_max_cents else instant_max_cents end
   where id = v.id;
  insert into public.request_events (request_id, event_type, from_status, to_status, actor_type, data)
  values (v.id, 'booking_mode', v.status, v.status, 'driver',
          jsonb_strip_nulls(jsonb_build_object('mode', p_mode, 'max_cents', case when p_mode = 'instant' then p_max_cents end)));
  return true;
end;
$$;
revoke all on function public.set_booking_mode(text, text, integer) from public;
grant execute on function public.set_booking_mode(text, text, integer) to anon, authenticated;

-- The ceiling is a hard rule, and the outcome (booked, fell back, cancelled) is kept per request.
create function public.instant_book_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('assigned', 'accepted') then
      if new.booking_mode = 'instant' and new.quoted_price_cents is not null
         and new.quoted_price_cents > new.instant_max_cents then
        raise exception 'Instant book: % is above the customer''s ceiling of %', new.quoted_price_cents, new.instant_max_cents
          using errcode = '22023';
      end if;
      new.booking_outcome := 'booked';
    elsif new.status = 'cancelled' then
      new.booking_outcome := coalesce(new.booking_outcome, 'cancelled');
    elsif new.status in ('expired', 'no_provider') then
      new.booking_outcome := coalesce(new.booking_outcome, 'fell_back');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.instant_book_rules() from public, anon, authenticated;
create trigger requests_instant_book before update of status on public.requests
  for each row execute function public.instant_book_rules();
