-- Batch 3: demo companies (created by "Sign in as demo" on dev and staging) are marked, and public
-- numbers (live proof on the website) never count them. Production never has demo companies.
alter table public.providers add column is_demo boolean not null default false;
update public.providers set is_demo = true where name like '%(demo)';

create or replace function public.market_public_stats(p_market_slug text)
returns table (provider_count integer, avg_eta_minutes integer, completed_jobs integer)
language sql stable security definer set search_path = '' as $$
  with m as (select id from public.markets where slug = p_market_slug::extensions.citext and status in ('test', 'active')),
  jobs as (
    select extract(epoch from (r.on_site_at - r.accepted_at)) / 60 as minutes
    from public.requests r join m on r.market_id = m.id
    where r.status = 'completed' and r.accepted_at is not null and r.on_site_at > r.accepted_at
      and r.completed_at > now() - interval '90 days'
  )
  select (select count(*)::int from public.providers p, m where p.status = 'active' and not p.is_demo and m.id = any (p.market_ids)),
         (select case when count(*) >= 10 then round(avg(minutes))::int end from jobs),
         (select count(*)::int from jobs)
  from m;
$$;
