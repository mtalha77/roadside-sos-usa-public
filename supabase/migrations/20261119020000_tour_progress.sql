-- RSOS-105: guided tour progress, per signed-in user, so "done", "skipped" and "don't show again"
-- follow the person across devices. Each person reads and writes only their own rows.
create table public.tour_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  tour text not null check (tour ~ '^[a-z0-9][a-z0-9_.-]{1,60}$'),
  status text not null check (status in ('started', 'done', 'skipped', 'hidden')),
  step smallint not null default 0 check (step between 0 and 50),
  updated_at timestamptz not null default now(),
  primary key (user_id, tour)
);
alter table public.tour_progress enable row level security;
create trigger tour_progress_updated_at before update on public.tour_progress
  for each row execute function public.set_updated_at();

create policy "people read their own tour progress" on public.tour_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "people add their own tour progress" on public.tour_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "people update their own tour progress" on public.tour_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "people reset their own tour progress" on public.tour_progress for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.tour_progress from anon;
grant select, insert, update, delete on public.tour_progress to authenticated;
