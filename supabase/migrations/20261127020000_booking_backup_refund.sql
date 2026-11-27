-- RSOS-117 fix: the backup refund (rule 4 of run_booking_timers) must look for a NEW booking for
-- the request, not count the late booking itself.
create or replace function public.run_booking_timers(p_now timestamptz default now())
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  rules public.booking_rules := public.booking_rule();
  x record;
  v_n integer := 0;
  v_released integer;
begin
  -- 1. No valid cancellation within the hour: charge.
  for x in
    select h.request_id, h.provider_id from public.fee_holds h
      left join public.bookings b on b.id = h.booking_id
     where h.status = 'held' and h.created_at < p_now - make_interval(mins => rules.charge_after_minutes)
       and (b.id is null or (b.status not in ('cancelled', 'replaced')
                             and (b.provider_report is distinct from 'no_show' or b.no_show_decided_at is not null)))
  loop
    perform public.settle_fee_hold(x.request_id, x.provider_id, 'charge', 'no cancellation within the hour');
    v_n := v_n + 1;
  end loop;

  -- 2. Provider no-shows, 15 minutes after the report.
  for x in
    select b.* from public.bookings b
     where b.provider_report = 'no_show' and b.no_show_decided_at is null
       and b.provider_report_at < p_now - make_interval(mins => rules.no_show_wait_minutes)
  loop
    update public.bookings set no_show_decided_at = p_now, status = 'cancelled', cancelled_by = 'customer',
           cancelled_at = coalesce(cancelled_at, p_now)
     where id = x.id;
    if x.arrived_at is not null and x.customer_answered_at is null then
      select count(*) into v_released from public.fee_holds h join public.bookings bb on bb.id = h.booking_id
       where h.provider_id = x.provider_id and h.status = 'released' and bb.provider_report = 'no_show'
         and h.settled_at >= date_trunc('month', p_now);
      if v_released < rules.no_show_release_limit then
        perform public.settle_fee_hold(x.request_id, x.provider_id, 'release', 'customer no-show (GPS at location)');
      else
        perform public.settle_fee_hold(x.request_id, x.provider_id, 'review', 'no-show over the monthly limit');
        perform public.raise_booking_flag(x.id, 'no_show_review');
      end if;
      insert into public.customer_reliability (market_id, customer_key, device_key, booking_id, kind)
      select x.market_id, x.customer_key, x.customer_device, x.id, 'no_show'
       where x.customer_key is not null or x.customer_device is not null;
    else
      perform public.settle_fee_hold(x.request_id, x.provider_id, 'charge', 'no-show not confirmed');
    end if;
    v_n := v_n + 1;
  end loop;

  -- 3. The provider has not arrived 30 minutes after the promised time: refund the booking fee.
  for x in
    select b.id from public.bookings b
     where b.booking_fee_status = 'paid' and b.status in ('booked', 'en_route') and b.arrived_at is null
       and b.promised_at < p_now - make_interval(mins => rules.late_refund_minutes)
  loop
    perform public.booking_fee_refund(x.id, 'provider late');
    v_n := v_n + 1;
  end loop;

  -- 4. Backup asked for and nobody new booked within 30 minutes: refund the booking fee.
  for x in
    select b.id from public.bookings b
     where b.status = 'replaced' and b.booking_fee_status = 'paid'
       and b.backup_requested_at < p_now - make_interval(mins => rules.late_refund_minutes)
       and not exists (select 1 from public.bookings n where n.request_id = b.request_id
                         and n.id <> b.id and n.created_at > b.backup_requested_at)
  loop
    perform public.booking_fee_refund(x.id, 'no other provider found');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
