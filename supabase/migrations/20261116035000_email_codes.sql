-- Batch 4 scope change from the owner: no SMS. Sign-in for drivers, providers and admins uses
-- email codes (Supabase Auth email OTP), so the phone-number sign-in lookup goes, and a Get Help
-- request can carry the driver's email (verified with an emailed code) for links and updates.

drop function if exists public.auth_user_for_phone(text);

alter table public.requests
  add column driver_email text check (driver_email is null or (length(driver_email) <= 254 and driver_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column driver_email_verified boolean not null default false;

-- Same as before (create_request, then delete the draft), now recording the driver's email and
-- whether its code was checked instead of a phone check.
drop function public.submit_web_request(jsonb, text, boolean);
create function public.submit_web_request(p jsonb, p_draft_token text, p_email text, p_email_verified boolean)
returns table (request_id uuid, short_code text, status_token text)
language plpgsql volatile security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.create_request(p);
  update public.requests
     set driver_email = nullif(lower(trim(p_email)), ''),
         driver_email_verified = coalesce(p_email_verified, false) and nullif(trim(p_email), '') is not null
   where id = r.request_id;
  delete from public.request_drafts where token = p_draft_token;
  return query select r.request_id, r.short_code, r.status_token;
end;
$$;
revoke execute on function public.submit_web_request(jsonb, text, text, boolean) from public;
grant execute on function public.submit_web_request(jsonb, text, text, boolean) to anon, authenticated;
