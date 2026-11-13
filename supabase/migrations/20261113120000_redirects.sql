-- RSOS-032: permanent redirects for moved pages (and the future domain change, which the proxy
-- handles by host). Managed as data by staff; read by the website through a definer function.
create table public.redirects (
  source_path text primary key check (source_path ~ '^/[^?#]*$' and source_path <> '/'),
  destination text not null check (destination ~ '^(/|https://)'),
  status_code integer not null default 301 check (status_code in (301, 308)),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger redirects_updated_at before update on public.redirects for each row execute function public.set_updated_at();
alter table public.redirects enable row level security;
revoke all on public.redirects from anon;
create policy "staff read redirects" on public.redirects for select to authenticated using (public.jwt_staff_role() is not null);
create policy "marketing manages redirects" on public.redirects for all to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'marketing')) with check (public.jwt_staff_role() in ('super_admin', 'marketing'));

create function public.list_redirects() returns table (source_path text, destination text, status_code integer)
language sql stable security definer set search_path = '' as $$
  select r.source_path, r.destination, r.status_code from public.redirects r where r.is_active order by r.source_path;
$$;
revoke execute on function public.list_redirects() from public;
grant execute on function public.list_redirects() to anon, authenticated;
