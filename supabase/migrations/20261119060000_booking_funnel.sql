-- RSOS-111: booking speed and funnel analytics. The website records, server-side, each Get Help
-- screen a visitor session sees, the screen and last field touched when they leave (a beacon), and
-- the submit with the seconds since landing. One row per session, event and step (deduplicated).
-- Sessions are random ids from a browser-session cookie: no name, phone or address is stored.
create table public.funnel_events (
  id bigint generated always as identity primary key,
  session_id text not null check (session_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  event text not null check (event in ('step', 'left', 'submitted')),
  step text not null check (step in ('problem', 'location', 'details')),
  last_field text check (last_field is null or last_field ~ '^[A-Za-z]{1,40}$'),
  market_id uuid references public.markets (id) on delete set null,
  source text check (source is null or source ~ '^[a-z_]{2,30}$'),
  device text check (device is null or device in ('mobile', 'desktop')),
  landing_sec integer check (landing_sec is null or landing_sec between 0 and 86400),
  request_id uuid references public.requests (id) on delete set null,
  occurred_at timestamptz not null default now(),
  unique (session_id, event, step)
);
create index funnel_events_time_idx on public.funnel_events (occurred_at desc);
create index funnel_events_request_idx on public.funnel_events (request_id) where request_id is not null;
alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;
grant select on public.funnel_events to authenticated;
create policy "analytics reads funnel events" on public.funnel_events for select to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing', 'read_only')
         and (market_id is null or public.staff_can_access_market(market_id)));

-- The website writes through this function only. A repeated event updates the field touched last
-- (a later leave beacon wins) and never creates a second row.
create function public.record_funnel_event(
  p_session text, p_event text, p_step text, p_field text default null, p_market_slug text default null,
  p_source text default null, p_device text default null, p_landing_sec integer default null,
  p_request_token text default null
) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.funnel_events as f
    (session_id, event, step, last_field, market_id, source, device, landing_sec, request_id)
  values (
    p_session, p_event, p_step, nullif(p_field, ''),
    (select m.id from public.markets m where m.slug = p_market_slug),
    nullif(p_source, ''), nullif(p_device, ''),
    case when p_event = 'submitted' then p_landing_sec end,
    case when p_event = 'submitted' and length(coalesce(p_request_token, '')) >= 24
         then (select r.id from public.requests r where r.status_token = p_request_token) end
  )
  on conflict (session_id, event, step) do update
    set last_field = coalesce(excluded.last_field, f.last_field),
        market_id = coalesce(f.market_id, excluded.market_id),
        occurred_at = case when f.event = 'left' then excluded.occurred_at else f.occurred_at end;
exception when check_violation or invalid_text_representation then
  -- Bad input from a visitor is ignored, never an error page.
  return;
end;
$$;
revoke all on function public.record_funnel_event(text, text, text, text, text, text, text, integer, text) from public;
grant execute on function public.record_funnel_event(text, text, text, text, text, text, text, integer, text) to anon, authenticated;
