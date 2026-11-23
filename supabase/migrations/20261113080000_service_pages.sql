-- RSOS-025: service page content and a local note per market and service, stored as data
-- (editable from admin later). Prices are never stored here: they come from market_services.

create table public.service_pages (
  service_id uuid not null references public.services (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'es')),
  summary text not null check (length(summary) between 40 and 600),
  covers text[] not null default '{}',
  not_covered text[] not null default '{}',
  what_to_expect text[] not null default '{}',
  -- Typical time on site once the provider arrives (guidance, not a promise).
  onsite_minutes_min integer check (onsite_minutes_min > 0),
  onsite_minutes_max integer check (onsite_minutes_max >= onsite_minutes_min),
  safety_tips text[] not null default '{}',
  faqs jsonb not null default '[]' check (jsonb_typeof(faqs) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (service_id, locale)
);
create trigger service_pages_updated_at before update on public.service_pages for each row execute function public.set_updated_at();

create table public.market_service_notes (
  market_id uuid not null references public.markets (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'es')),
  note text not null check (length(note) between 40 and 800),
  updated_at timestamptz not null default now(),
  primary key (market_id, service_id, locale)
);
create trigger market_service_notes_updated_at before update on public.market_service_notes for each row execute function public.set_updated_at();

alter table public.service_pages enable row level security;
alter table public.market_service_notes enable row level security;
revoke all on public.service_pages, public.market_service_notes from anon;
create policy "staff read service pages" on public.service_pages for select to authenticated using (public.jwt_staff_role() is not null);
create policy "marketing edits service pages" on public.service_pages for all to authenticated
  using (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'))
  with check (public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));
create policy "staff read local notes" on public.market_service_notes for select to authenticated using (public.staff_can_access_market(market_id));
create policy "marketing edits local notes" on public.market_service_notes for all to authenticated
  using (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'))
  with check (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));

create function public.get_service_page(p_service_slug text, p_locale text default 'en')
returns table (summary text, covers text[], not_covered text[], what_to_expect text[], onsite_minutes_min integer,
               onsite_minutes_max integer, safety_tips text[], faqs jsonb)
language sql stable security definer set search_path = '' as $$
  select p.summary, p.covers, p.not_covered, p.what_to_expect, p.onsite_minutes_min, p.onsite_minutes_max, p.safety_tips, p.faqs
  from public.services s join public.service_pages p on p.service_id = s.id
  where s.slug = p_service_slug::extensions.citext and p.locale in (p_locale, 'en')
  order by (p.locale = p_locale) desc
  limit 1;
$$;

-- Local note for a published market and a service.
create function public.get_market_service_note(p_market_slug text, p_service_slug text, p_locale text default 'en')
returns text
language sql stable security definer set search_path = '' as $$
  select n.note
  from public.market_service_notes n
  join public.markets m on m.id = n.market_id and m.status in ('test', 'active')
  join public.services s on s.id = n.service_id
  where m.slug = p_market_slug::extensions.citext and s.slug = p_service_slug::extensions.citext and n.locale in (p_locale, 'en')
  order by (n.locale = p_locale) desc
  limit 1;
$$;
revoke execute on function public.get_service_page(text, text), public.get_market_service_note(text, text, text) from public;
grant execute on function public.get_service_page(text, text), public.get_market_service_note(text, text, text) to anon, authenticated;

insert into public.service_pages (service_id, locale, summary, covers, not_covered, what_to_expect, onsite_minutes_min, onsite_minutes_max, safety_tips, faqs)
select s.id, 'en', c.summary, c.covers, c.not_covered, c.expect, c.min, c.max, c.tips, c.faqs::jsonb
from public.services s
join (values
  ('flat-tire',
   'A provider comes to you and puts on your spare, or plugs a simple tread puncture, so you can drive to a tire shop.',
   array['Removing the flat and fitting your spare (full-size or donut)', 'Plugging a small puncture in the tread when it is safe to repair', 'Checking and inflating the spare'],
   array['A new tire (the provider can tell you where to buy one)', 'Sidewall damage, which cannot be plugged safely', 'Locking wheel nuts without the key'],
   array['Tell us your vehicle and whether you have a spare and the wheel lock key.', 'The provider jacks the vehicle up on a safe, level spot and swaps or repairs the tire.', 'Drive to a tire shop soon: a donut spare is for short, slow trips.'],
   15, 30,
   array['Pull as far off the road as you can and turn on your hazard lights.', 'Do not try to change a tire on the traffic side of a highway.', 'Driving on a flat can ruin the wheel. Stop as soon as it is safe.'],
   '[{"q": "I do not have a spare. Can you still help?", "a": "If the puncture is small and in the tread, a plug may work. Otherwise choose a tow to a tire shop."}, {"q": "Can a provider fix a tire on a motorcycle?", "a": "Flat tire help covers cars, SUVs, pickups, vans and RVs. For a motorcycle, request a tow."}, {"q": "How much does it cost?", "a": "Each provider quotes a full price before you choose. Typical local ranges are shown on this page."}]'),
  ('wont-start',
   'A provider comes with a jump pack or cables to start a dead battery, so you can get moving and get the battery checked.',
   array['Jump starting a dead or weak battery', 'Checking the battery terminals for loose or corroded clamps', 'Advice on whether the battery or alternator needs a shop'],
   array['A new battery, unless the provider offers one (ask when you choose)', 'Engine, starter or fuel problems that a jump will not fix'],
   array['Tell us your vehicle and what happens when you turn the key (clicking, nothing, or cranking without starting).', 'The provider connects a jump pack, starts the engine and checks it keeps running.', 'Keep the engine running for a while, or drive straight to a shop to test the battery.'],
   10, 20,
   array['Turn off lights, radio and air conditioning before the jump.', 'If you smell gasoline or see smoke, do not try to start the car: move away and call 911.', 'In heat, wait somewhere shaded and keep water with you.'],
   '[{"q": "My car clicks but does not start. Is that the battery?", "a": "Rapid clicking usually means a weak battery, and a jump start often fixes it. If it cranks but does not start, the problem may be fuel or the engine, and a tow may be the better choice."}, {"q": "Can you start a hybrid or electric vehicle?", "a": "Many hybrids have a small 12-volt battery that can be jump started. Tell us your vehicle so providers can quote."}, {"q": "How much does it cost?", "a": "Each provider quotes a full price before you choose. Typical local ranges are shown on this page."}]'),
  ('locked-out',
   'A provider opens your vehicle when your keys are locked inside, using tools that do not damage the door or window.',
   array['Opening a locked car, SUV, pickup or van door', 'Getting keys out of a locked vehicle'],
   array['Making new keys or programming key fobs (that needs a locksmith or dealer)', 'Opening a trunk on some models where the cabin release is the only access'],
   array['Be ready to show ID with your name and the vehicle''s registration or insurance once it is open.', 'The provider opens the door, usually in a few minutes.', 'If a child or pet is locked in a hot car, call 911 first.'],
   5, 20,
   array['If a child or pet is inside, call 911 right away.', 'Wait somewhere safe and visible, away from traffic.', 'Do not try to break a window yourself.'],
   '[{"q": "Will opening my car damage it?", "a": "Providers use lockout tools designed to open doors without damage. Ask the provider about their method before they start if you are unsure."}, {"q": "Do I need to prove the car is mine?", "a": "Yes. Providers will ask for ID and proof of ownership once the vehicle is open."}, {"q": "How much does it cost?", "a": "Each provider quotes a full price before you choose. Typical local ranges are shown on this page."}]'),
  ('out-of-gas',
   'A provider brings enough fuel to get you to the nearest gas station. You pay for the fuel on top of the service.',
   array['Delivering gasoline (and diesel where the provider offers it)', 'Pouring it in and helping you restart the engine'],
   array['Filling the tank: you get enough to reach a station', 'Fixing a fuel leak or a broken fuel gauge'],
   array['Tell us your vehicle and the fuel it takes.', 'The provider brings fuel, adds it and checks the engine starts.', 'Drive to the nearest station and fill up.'],
   10, 15,
   array['Stop somewhere off the road, not on a bridge or curve.', 'Do not walk along a highway to find fuel.', 'Never smoke near fuel.'],
   '[{"q": "Is the fuel included in the price?", "a": "No. Quotes cover the service; the fuel is charged on top at about the local pump price. Ask the provider when you choose."}, {"q": "Can you bring diesel?", "a": "Some providers can. Choose your vehicle and fuel type when you request help."}, {"q": "How much does it cost?", "a": "Each provider quotes a full price for the service before you choose. Typical local ranges are shown on this page."}]'),
  ('tow',
   'A provider tows your vehicle to a repair shop, your home or another place you choose. Distance affects the price.',
   array['Towing cars, SUVs, pickups, vans and motorcycles', 'Flatbed or wheel-lift, depending on the vehicle and the provider', 'Taking you to the place you choose'],
   array['Heavy-duty trucks, buses and large RVs (ask a heavy-duty towing company)', 'Storage after the tow, unless you arrange it with the provider'],
   array['Tell us where you are and where the vehicle should go.', 'The provider loads the vehicle safely and confirms the destination with you.', 'Remove valuables and keys you need before the vehicle is loaded.'],
   20, 45,
   array['Stay off the road while you wait, and keep your hazard lights on.', 'On a highway, stay in your vehicle with your seatbelt on unless it is safer to get out.', 'Ask whether you can ride in the tow truck: not every provider allows it.'],
   '[{"q": "How is the price calculated?", "a": "Providers quote a full price, usually a hook-up fee plus a per-mile charge. Tell us the destination so quotes are accurate."}, {"q": "Can I ride with my vehicle?", "a": "Some providers allow one passenger. Ask when you choose a quote."}, {"q": "Do tow providers need a license?", "a": "In Texas, tow operators need a license from the Texas Department of Licensing and Regulation (TDLR). We check licenses where they are required."}]'),
  ('winch-out',
   'A provider pulls your vehicle out of mud, sand, snow or a shallow ditch with a winch, when it is stuck but not damaged.',
   array['Winching a car, SUV, pickup or van back onto a firm surface', 'Checking the vehicle can be driven afterwards'],
   array['Vehicles in deep water or that rolled over (that needs a recovery specialist)', 'Damage caused by getting stuck'],
   array['Tell us how the vehicle is stuck and how far it is from the road.', 'The provider anchors the winch and pulls the vehicle out slowly.', 'If it cannot be driven afterwards, the provider can quote a tow.'],
   20, 60,
   array['Do not keep spinning the wheels: it digs the vehicle in deeper.', 'Stand well clear of a winch cable under tension.', 'If water is rising around the vehicle, get out to higher ground and call 911.'],
   '[{"q": "Is winch out available in my city?", "a": "Not yet. We are adding it city by city. For now, request a tow and mention that the vehicle is stuck."}, {"q": "How is it different from a tow?", "a": "A winch out pulls the vehicle back to a firm surface so you can drive away. A tow takes it somewhere else."}, {"q": "How much does it cost?", "a": "When it is available, each provider will quote a full price before you choose."}]')
) as c(slug, summary, covers, not_covered, expect, min, max, tips, faqs) on s.slug = c.slug::extensions.citext
on conflict (service_id, locale) do nothing;

insert into public.market_service_notes (market_id, service_id, locale, note)
select m.id, s.id, 'en', c.note
from (values
  ('san-antonio', 'flat-tire', 'Potholes and debris on Loop 410 and in I-35 work zones cause plenty of flats in San Antonio. If you are on a narrow shoulder, take the next exit if you safely can, then request help from a parking lot.'),
  ('san-antonio', 'wont-start', 'Long, hot summers in San Antonio shorten battery life, and many no-starts happen after a car sits in the sun. A jump start usually gets you going; have the battery tested soon after.'),
  ('san-antonio', 'locked-out', 'Locked out at a River Walk garage, a stadium lot or a trailhead in the Hill Country? Tell us the garage level or nearest landmark so the provider finds you fast.'),
  ('san-antonio', 'out-of-gas', 'Past Loop 1604 and out toward Bandera, Hondo or Pleasanton, gas stations can be far apart. A provider can bring enough fuel to reach the next one.'),
  ('san-antonio', 'tow', 'Providers tow across Bexar County and the surrounding counties, from New Braunfels to Castroville. Texas tow operators need a TDLR license, which we check before they can quote.'),
  ('san-antonio', 'winch-out', 'Winch out is not offered in San Antonio yet. If your vehicle is stuck on a ranch road or a soft shoulder after a storm, request a tow and mention that it is stuck.'),
  ('las-vegas', 'flat-tire', 'Hot pavement and desert debris are hard on tires in Las Vegas. If you get a flat on I-15 or the 215, move to the shoulder or the next exit and keep water with you while you wait.'),
  ('las-vegas', 'wont-start', 'Heat is the main reason batteries die in Las Vegas, often after a car sits in a hot parking lot. A jump start usually works; plan a battery test soon after.'),
  ('las-vegas', 'locked-out', 'Locked out in a casino garage or a busy lot on the Strip? Tell us the garage name, level and nearest elevator so the provider can reach you quickly.'),
  ('las-vegas', 'out-of-gas', 'Running out of fuel on US 95 or the way to Boulder City happens more often than people think. A provider brings enough fuel to reach the nearest station.'),
  ('las-vegas', 'tow', 'Providers tow across Clark County, from Henderson to North Las Vegas. Some casino garages have low clearance, so tell us where the vehicle is parked.'),
  ('las-vegas', 'winch-out', 'Winch out is not offered in Las Vegas yet. If your vehicle is stuck in sand off a desert road, request a tow and mention that it is stuck.'),
  ('houston', 'flat-tire', 'Long commutes on I-45, I-10 and the Beltway mean flats far from home. Tell the provider which side of the freeway you are on and the nearest exit or feeder road.'),
  ('houston', 'wont-start', 'Humid summers and short trips in Houston traffic wear batteries down. A jump start usually gets you going; if the car stalled in high water, choose a tow instead.'),
  ('houston', 'locked-out', 'Locked out at a Medical Center garage, a Galleria lot or at home in Katy or The Woodlands? Tell us the garage or nearest landmark so the provider finds you fast.'),
  ('houston', 'out-of-gas', 'Stuck in a long backup on I-69 or US 290 can drain the tank. A provider brings enough fuel to reach the nearest station.'),
  ('houston', 'tow', 'Providers tow across Harris, Fort Bend and Montgomery counties. After heavy rain, never drive into a flooded road: request a tow from higher ground. Texas tow operators need a TDLR license, which we check.'),
  ('houston', 'winch-out', 'Winch out is not offered in Houston yet. If your vehicle slid into a muddy ditch after a storm, request a tow and mention that it is stuck.')
) as c(market_slug, service_slug, note)
join public.markets m on m.slug = c.market_slug::extensions.citext
join public.services s on s.slug = c.service_slug::extensions.citext
on conflict (market_id, service_id, locale) do nothing;
