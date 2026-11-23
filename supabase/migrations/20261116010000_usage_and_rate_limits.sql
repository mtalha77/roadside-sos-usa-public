-- RSOS-021b: Postgres-backed rate limits (Upstash is not configured yet) and a daily usage
-- counter for paid APIs (Google Maps, Twilio Verify, texts) with an alert threshold per vendor.

-- ---------------------------------------------------------------------------------------------
-- Rate limits: fixed windows per key. Only the definer function touches the table.
-- ---------------------------------------------------------------------------------------------
create table public.rate_limit_counters (
  key text primary key check (length(key) between 3 and 200),
  window_start timestamptz not null,
  count integer not null check (count >= 0)
);
alter table public.rate_limit_counters enable row level security;
-- No policies: nobody reads or writes the table directly; rate_limit_hit() does.

-- Increments the counter for p_key and returns the new count in the current window.
create function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_key is null or length(p_key) not between 3 and 200 then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid window' using errcode = '22023';
  end if;
  insert into public.rate_limit_counters as c (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when c.window_start <= now() - make_interval(secs => p_window_seconds)
                     then 1 else c.count + 1 end,
        window_start = case when c.window_start <= now() - make_interval(secs => p_window_seconds)
                            then now() else c.window_start end
  returning count into v_count;
  return v_count;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer) from public;
grant execute on function public.rate_limit_hit(text, integer) to anon, authenticated;

-- Old windows are swept daily-ish by the caller side; keep the table small.
create function public.rate_limit_sweep() returns integer
language sql volatile security definer set search_path = '' as $$
  with d as (delete from public.rate_limit_counters where window_start < now() - interval '1 day' returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.rate_limit_sweep() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Paid API usage per day and vendor
-- ---------------------------------------------------------------------------------------------
create table public.api_usage (
  day date not null,
  vendor text not null check (vendor ~ '^[a-z][a-z0-9_]{1,40}$'),
  units integer not null default 0 check (units >= 0),
  alerted_at timestamptz,
  primary key (day, vendor)
);
alter table public.api_usage enable row level security;
create policy "staff read api usage" on public.api_usage for select to authenticated
  using (public.jwt_staff_role() is not null);

-- Daily alert thresholds per vendor group (maps, twilio). Super admins change them.
create table public.usage_thresholds (
  vendor_group text primary key check (vendor_group in ('maps', 'twilio')),
  daily_units integer not null check (daily_units > 0),
  updated_at timestamptz not null default now()
);
alter table public.usage_thresholds enable row level security;
create policy "staff read usage thresholds" on public.usage_thresholds for select to authenticated
  using (public.jwt_staff_role() is not null);
create policy "super admins change usage thresholds" on public.usage_thresholds for update to authenticated
  using (public.jwt_staff_role() = 'super_admin') with check (public.jwt_staff_role() = 'super_admin');
insert into public.usage_thresholds (vendor_group, daily_units) values ('maps', 2000), ('twilio', 300);

-- Counts usage (any server, including the website's anonymous client) and says whether the
-- vendor group just crossed its daily threshold for the first time today (send one alert).
create function public.record_api_usage(p_vendor text, p_units integer default 1)
returns table (units_today integer, threshold integer, alert boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_group text := split_part(p_vendor, '_', 1);
  v_units integer;
  v_threshold integer;
  v_group_units integer;
  v_alert boolean := false;
begin
  if p_vendor is null or p_vendor !~ '^(maps|twilio)_[a-z0-9_]{1,30}$' then
    raise exception 'invalid vendor' using errcode = '22023';
  end if;
  if p_units is null or p_units not between 1 and 1000 then
    raise exception 'invalid units' using errcode = '22023';
  end if;
  insert into public.api_usage as u (day, vendor, units) values (current_date, p_vendor, p_units)
  on conflict (day, vendor) do update set units = u.units + excluded.units
  returning u.units into v_units;
  select t.daily_units into v_threshold from public.usage_thresholds t where t.vendor_group = v_group;
  select coalesce(sum(u.units), 0)::integer into v_group_units
  from public.api_usage u where u.day = current_date and split_part(u.vendor, '_', 1) = v_group;
  if v_threshold is not null and v_group_units >= v_threshold then
    update public.api_usage u set alerted_at = now()
    where u.day = current_date and u.vendor = p_vendor
      and not exists (select 1 from public.api_usage x
                      where x.day = current_date and split_part(x.vendor, '_', 1) = v_group
                        and x.alerted_at is not null);
    v_alert := found;
  end if;
  return query select v_group_units, v_threshold, v_alert;
end;
$$;
revoke all on function public.record_api_usage(text, integer) from public;
grant execute on function public.record_api_usage(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- SMS sign-in (provider and admin apps): after Twilio Verify approves a code, the server finds
-- the account for that phone. Service role only; returns whether it is a demo account so the
-- fake verifier (no Twilio keys, never in production) can only open demo accounts.
-- ---------------------------------------------------------------------------------------------
create function public.auth_user_for_phone(p_phone text)
returns table (user_id uuid, email text, is_demo boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, exists (select 1 from public.demo_accounts d where d.user_id = u.id)
  from auth.users u
  where p_phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    and u.phone = ltrim(p_phone, '+')
    and u.deleted_at is null
    and u.email is not null
  order by u.created_at
  limit 1;
$$;
revoke all on function public.auth_user_for_phone(text) from public, anon, authenticated;
grant execute on function public.auth_user_for_phone(text) to service_role;
