# First super admin (production)

Production starts with no staff accounts. The owner's account is created once, after the first
release has applied the migrations to `rsos-prod`. Other staff accounts are added the same way, with
their own role (`ops_manager`, `dispatcher`, `support`, `finance`, `marketing` or `read_only`) and,
if they should only see some markets, `market_ids`. Admin > Staff lists them and resets their
second step; it cannot invite yet.

1. **Create the sign-in.** Supabase dashboard, project `rsos-prod`: Authentication > Users > Add
   user > Create new user. Use the owner's email and a password of at least 12 characters, and
   tick "Auto confirm user".
2. **Make it the owner.** Supabase dashboard > SQL Editor, on `rsos-prod`. Replace the email:

   ```sql
   insert into public.staff_members (user_id, role, display_name)
   select id, 'super_admin', 'Owner' from auth.users where email = 'owner@example.com'
   on conflict (user_id) do update set role = 'super_admin', is_active = true;
   ```

3. **Sign in.** Go to `https://admin.roadrescuesos.com/sign-in` and sign in with that email and
   password. The admin requires a second step, so set up the authenticator app it shows (1Password,
   Google Authenticator or Authy) and enter the 6-digit code. Save the recovery codes.
4. **Check.** Admin > Staff (and Settings > Users and roles) list the owner as `super_admin`.

The role is read from the `staff_members` row when the session is issued, so sign out and back in
after any role change.
