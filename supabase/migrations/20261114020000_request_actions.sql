-- RSOS-022/068: the driver cancels from the status page with a reason (no account; the unguessable
-- status token is the credential). Not possible once the provider is on site or the job is over.
create function public.cancel_request_by_token(p_token text, p_reason text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare r public.requests%rowtype;
begin
  if p_reason not in ('found_help', 'too_slow', 'too_expensive', 'fixed', 'other') then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  select * into r from public.requests where status_token = p_token and length(p_token) >= 24 for update;
  if r.id is null or r.status in ('on_site', 'completed', 'cancelled', 'expired') then return false; end if;
  update public.requests set status = 'cancelled', cancelled_at = now() where id = r.id;
  insert into public.request_events (request_id, event_type, from_status, to_status, actor_type, data)
  values (r.id, 'cancelled', r.status, 'cancelled', 'driver', jsonb_build_object('reason', p_reason));
  return true;
end;
$$;
revoke execute on function public.cancel_request_by_token(text, text) from public;
grant execute on function public.cancel_request_by_token(text, text) to anon, authenticated;
