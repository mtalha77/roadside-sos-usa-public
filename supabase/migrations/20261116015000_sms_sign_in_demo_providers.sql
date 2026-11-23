-- RSOS-021b fix: demo provider accounts are not in demo_accounts (that table holds the admin
-- demo authenticator secrets); they are members of a demo provider. Both count as demo accounts,
-- so the fake verifier (no Twilio keys, never in production) can open them and nothing else.
create or replace function public.auth_user_for_phone(p_phone text)
returns table (user_id uuid, email text, is_demo boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text,
         exists (select 1 from public.demo_accounts d where d.user_id = u.id)
         or exists (select 1 from public.provider_members m
                    join public.providers p on p.id = m.provider_id
                    where m.user_id = u.id and p.is_demo)
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
