-- RSOS-023: the driver's location link (/l/<token>). The website has no service key, so the page
-- reads and submits through definer functions that check the token: unguessable (22+ characters),
-- 2 hours, one request. The optional vehicle photo goes to the private job-photos bucket under
-- loc/<token>/, which anonymous visitors may write only while the token is valid.

create function public.location_link_valid(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.location_links l
                 join public.requests r on r.id = l.request_id
                 where l.token = p_token and l.expires_at > now()
                   and r.status not in ('completed', 'cancelled', 'no_provider', 'expired'));
$$;
revoke all on function public.location_link_valid(text) from public;
grant execute on function public.location_link_valid(text) to anon, authenticated;

-- What the page needs: whether the link works, the market centre (map bias) and any address so far.
create function public.get_location_link(p_token text)
returns table (valid boolean, used boolean, market_slug text, center_lat double precision,
               center_lng double precision, current_address text)
language sql stable security definer set search_path = '' as $$
  select (l.expires_at > now() and r.status not in ('completed', 'cancelled', 'no_provider', 'expired')),
         l.used_at is not null,
         m.slug::text,
         extensions.st_y(m.center::extensions.geometry), extensions.st_x(m.center::extensions.geometry),
         r.pickup_address
  from public.location_links l
  join public.requests r on r.id = l.request_id
  join public.markets m on m.id = r.market_id
  where l.token = p_token and length(p_token) >= 22;
$$;
revoke all on function public.get_location_link(text) from public;
grant execute on function public.get_location_link(text) to anon, authenticated;

-- The driver confirms the pin: the request's location is updated, the timeline records it, and
-- the inbox hears about it through Realtime (requests and request_events are published).
create function public.submit_location(
  p_token text, p_lat double precision, p_lng double precision, p_address text,
  p_note text default null, p_photo_path text default null)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_request uuid;
begin
  if not public.location_link_valid(p_token) then return false; end if;
  if p_lat not between 18 and 72 or p_lng not between -180 and -64 then
    raise exception 'outside the US' using errcode = '22023';
  end if;
  if p_photo_path is not null and p_photo_path !~ ('^loc/' || p_token || '/[A-Za-z0-9._-]{1,80}$') then
    raise exception 'invalid photo path' using errcode = '22023';
  end if;
  select request_id into v_request from public.location_links where token = p_token;
  update public.requests set
    pickup_point = extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    pickup_address = left(coalesce(nullif(trim(p_address), ''), pickup_address,
                                   round(p_lat::numeric, 5) || ', ' || round(p_lng::numeric, 5)), 300),
    pickup_note = coalesce(nullif(left(trim(coalesce(p_note, '')), 300), ''), pickup_note),
    urgent = true
  where id = v_request;
  update public.location_links set used_at = now() where token = p_token;
  insert into public.request_events (request_id, event_type, actor_type, data)
  values (v_request, 'location_shared', 'driver',
          jsonb_strip_nulls(jsonb_build_object('photo', p_photo_path, 'note', nullif(trim(coalesce(p_note, '')), ''))));
  return true;
end;
$$;
revoke all on function public.submit_location(text, double precision, double precision, text, text, text) from public;
grant execute on function public.submit_location(text, double precision, double precision, text, text, text) to anon, authenticated;

-- Vehicle photos: visitors upload only into their own valid link's folder; staff read photos of
-- requests in their markets; nobody else reads them.
create policy "drivers upload a vehicle photo with a valid link" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'job-photos'
              and (storage.foldername(name))[1] = 'loc'
              and public.location_link_valid((storage.foldername(name))[2]));
create policy "staff read vehicle photos in their markets" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos'
         and (storage.foldername(name))[1] = 'loc'
         and exists (select 1 from public.location_links l join public.requests r on r.id = l.request_id
                     where l.token = (storage.foldername(name))[2] and public.staff_can_access_market(r.market_id)));
