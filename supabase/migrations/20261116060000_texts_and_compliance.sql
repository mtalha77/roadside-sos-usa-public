-- RSOS-035: transactional texts. Templates live in the database (admin-editable, English and
-- Spanish, placeholders); a system setting holds the A2P 10DLC registration status and the owner's
-- override; delivery reporting per day from the stored Twilio status callbacks.

create table public.sms_templates (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  title text not null check (length(title) between 2 and 80),
  body_en text not null check (length(body_en) between 2 and 640),
  body_es text not null check (length(body_es) between 2 and 640),
  -- Urgent job texts may go out during quiet hours (9pm to 8am in the market's time zone).
  urgent boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.sms_templates enable row level security;
create policy "staff read sms templates" on public.sms_templates for select to authenticated
  using (public.jwt_staff_role() is not null);
create policy "managers edit sms templates" on public.sms_templates for update to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));

insert into public.sms_templates (key, title, body_en, body_es, urgent) values
  ('location_link', 'Location link after a call',
   'Thanks for calling {brand}. Share your exact location here: {link}',
   'Gracias por llamar a {brand}. Comparte tu ubicación exacta aquí: {link}', true),
  ('provider_assigned', 'Provider assigned',
   'Hi {first_name}, {provider} is on the way. Quoted price {price}, about {eta} min. Track here: {link}',
   'Hola {first_name}, {provider} va en camino. Precio cotizado {price}, unos {eta} min. Sigue aquí: {link}', true),
  ('still_looking', 'Still looking for a provider',
   'Hi {first_name}, we are still finding a provider near you. We will text you as soon as one confirms.',
   'Hola {first_name}, seguimos buscando un proveedor cerca de ti. Te escribiremos en cuanto uno confirme.', true),
  ('job_completed', 'Job completed, ask for a review',
   'Thanks for using {brand}, {first_name}. How did it go? Rate your provider: {link}',
   'Gracias por usar {brand}, {first_name}. ¿Cómo te fue? Califica a tu proveedor: {link}', false),
  ('help', 'HELP reply',
   '{brand}: roadside help dispatch. For support email {support}. Reply STOP to opt out. Msg & data rates may apply.',
   '{brand}: despacho de asistencia en carretera. Soporte: {support}. Responde STOP para darte de baja. Pueden aplicar tarifas.', true);

-- Key/value settings for the whole system (super admins change them).
create table public.system_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.system_settings enable row level security;
create policy "staff read system settings" on public.system_settings for select to authenticated
  using (public.jwt_staff_role() is not null);
create policy "super admins change system settings" on public.system_settings for update to authenticated
  using (public.jwt_staff_role() = 'super_admin') with check (public.jwt_staff_role() = 'super_admin');
-- Until the carrier registration is approved, texts to anyone but test numbers are held.
insert into public.system_settings (key, value) values
  ('a2p_10dlc', '{"status": "pending", "override": false}');

-- Delivery report: per day and market, how many texts were sent, delivered, failed, undelivered,
-- held or blocked, and the most common Twilio error codes (staff, their markets).
create function public.sms_delivery_report(p_days integer default 14)
returns table (day date, market_id uuid, sent integer, delivered integer, failed integer,
               undelivered integer, held integer, blocked integer, received integer, top_errors integer[])
language sql stable security invoker set search_path = '' as $$
  select (m.created_at at time zone 'UTC')::date, m.market_id,
         count(*) filter (where m.direction = 'outbound' and m.status in ('sent', 'delivered', 'undelivered', 'failed'))::int,
         count(*) filter (where m.status = 'delivered')::int,
         count(*) filter (where m.status = 'failed')::int,
         count(*) filter (where m.status = 'undelivered')::int,
         count(*) filter (where m.status = 'held')::int,
         count(*) filter (where m.status = 'blocked')::int,
         count(*) filter (where m.direction = 'inbound')::int,
         (array_agg(distinct m.error_code) filter (where m.error_code is not null))[1:5]
  from public.sms_messages m
  where m.created_at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by 1, 2
  order by 1 desc;
$$;
revoke all on function public.sms_delivery_report(integer) from public, anon;
grant execute on function public.sms_delivery_report(integer) to authenticated;

-- Provider applications (RSOS-035 emails): operations review them (approve or reject).
create policy "operations review applications" on public.provider_applications for update to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager'));
