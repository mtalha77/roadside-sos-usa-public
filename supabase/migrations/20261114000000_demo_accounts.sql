-- Batch 3: demo sign-in on development, previews and staging. Holds the authenticator secret of
-- each demo account so the server can pass the admin second step. No one but the service role can
-- read it; the table stays empty in production (demo sign-in is disabled there in code).
create table public.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('provider_owner', 'provider_operator', 'admin_super', 'admin_dispatcher')),
  totp_secret text,
  created_at timestamptz not null default now()
);
alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;
