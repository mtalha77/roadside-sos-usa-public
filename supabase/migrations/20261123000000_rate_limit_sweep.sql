-- Owner decision (release 1): rate limiting on the Postgres counter is the real limiter until
-- Upstash is configured. Counters now exist per IP, per email or phone and per market, so old
-- windows are swept every night (rate_limit_sweep() was never scheduled before).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rate-limit-sweep') then
    perform cron.unschedule('rate-limit-sweep');
  end if;
  perform cron.schedule('rate-limit-sweep', '17 4 * * *', 'select public.rate_limit_sweep()');
end
$$;
