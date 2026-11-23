-- RSOS-024: city page content per market, stored as data (editable from admin later), with
-- unique copy for the three test markets. Unpublished markets (draft, paused) have no public page.

create table public.market_pages (
  market_id uuid not null references public.markets (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'es')),
  headline text not null check (length(headline) between 10 and 140),
  intro text not null check (length(intro) between 80 and 1500),
  areas text[] not null default '{}',
  highways text[] not null default '{}',
  local_tips text[] not null default '{}',
  -- [{"q": "...", "a": "..."}]
  faqs jsonb not null default '[]' check (jsonb_typeof(faqs) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (market_id, locale)
);
create trigger market_pages_updated_at before update on public.market_pages for each row execute function public.set_updated_at();

alter table public.market_pages enable row level security;
revoke all on public.market_pages from anon;
create policy "staff read market pages" on public.market_pages for select to authenticated
  using (public.staff_can_access_market(market_id));
create policy "marketing edits market pages" on public.market_pages for all to authenticated
  using (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'))
  with check (public.staff_can_access_market(market_id) and public.jwt_staff_role() in ('super_admin', 'ops_manager', 'marketing'));

-- Page content for a published market in a locale (falls back to English).
create function public.get_market_page(p_market_slug text, p_locale text default 'en')
returns table (headline text, intro text, areas text[], highways text[], local_tips text[], faqs jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.headline, p.intro, p.areas, p.highways, p.local_tips, p.faqs, greatest(p.updated_at, m.updated_at)
  from public.markets m
  join public.market_pages p on p.market_id = m.id
  where m.slug = p_market_slug::extensions.citext and m.status in ('test', 'active')
    and p.locale in (p_locale, 'en')
  order by (p.locale = p_locale) desc
  limit 1;
$$;
revoke execute on function public.get_market_page(text, text) from public;
grant execute on function public.get_market_page(text, text) to anon, authenticated;

-- Content for the three test markets (written for each city; reviewed facts only, no statistics).
insert into public.market_pages (market_id, locale, headline, intro, areas, highways, local_tips, faqs)
select m.id, 'en', c.headline, c.intro, c.areas, c.highways, c.tips, c.faqs::jsonb
from public.markets m
join (values
  ('san-antonio',
   'Roadside help in San Antonio, from Loop 410 to the Hill Country',
   'San Antonio drivers deal with long stretches of I-35 and I-10 construction, summer heat that drains batteries, and trips that run out past Loop 1604 into the Hill Country. Tell us where you are and what happened, and independent providers across Bexar County and the surrounding counties send you a price and an arrival time. You choose who comes, and you pay them directly.',
   array['Downtown and the River Walk', 'Medical Center', 'Stone Oak', 'Alamo Heights', 'Leon Valley', 'Converse and Universal City', 'Schertz and Cibolo', 'New Braunfels', 'Boerne', 'Seguin', 'Castroville and Hondo', 'Floresville', 'Pleasanton', 'Bandera'],
   array['I-35', 'I-10', 'I-37', 'Loop 410', 'Loop 1604', 'US 281', 'US 90', 'SH 151', 'SH 16'],
   array['Summer heat is hard on batteries: if your car clicks but will not start, a jump start is usually the quickest fix.', 'On I-35 and I-10 work zones the shoulder can be narrow. If you can, take the next exit or pull into a parking lot before you stop.', 'Out past Loop 1604 gas stations are farther apart, so fuel delivery can save a long walk.'],
   '[{"q": "Do you cover New Braunfels, Boerne and Seguin?", "a": "Yes. Our San Antonio area includes Bexar, Comal, Guadalupe, Kendall, Medina, Wilson, Atascosa and Bandera counties. Providers who cover your location can quote."}, {"q": "Do tow providers in Texas need a license?", "a": "Yes. Texas tow operators need a license from the Texas Department of Licensing and Regulation (TDLR). We check it before a tow provider can quote."}, {"q": "Can I get help on Loop 1604 or I-35 at night?", "a": "You can send a request any time. Providers who are working nearby will quote with their arrival time, so you can see who can come before you choose."}]'),
  ('las-vegas',
   'Roadside help in Las Vegas and across Clark County',
   'In Las Vegas the heat is the problem more often than the traffic: batteries and tires fail fast in summer, and a breakdown on I-15 or the 215 Beltway is no place to wait long. Share your location and what went wrong, and independent providers in the valley reply with a price and how soon they can get to you, whether you are near the Strip, in Henderson or out toward Summerlin. You pick one and pay them directly.',
   array['The Strip', 'Downtown and Fremont Street', 'Henderson', 'North Las Vegas', 'Summerlin', 'Spring Valley', 'Enterprise and Southern Highlands', 'Paradise', 'Green Valley', 'Centennial Hills', 'Boulder City'],
   array['I-15', 'I-11', 'US 95', 'I-215 and the 215 Beltway', 'US 93', 'Las Vegas Boulevard', 'Charleston Boulevard'],
   array['In summer, wait somewhere shaded or in your car with the air conditioning on if it is safe, and keep water with you.', 'Hot pavement is hard on tires. If you have a spare, a provider can fit it so you can drive to a shop.', 'Hotel and casino garages often have their own rules for tow trucks. Tell the provider which level and exit you are near.'],
   '[{"q": "Can a provider reach me in a hotel or casino parking garage?", "a": "Usually, yes. Some garages have low clearance that a tow truck cannot enter, so mention it in your request. A jump start, lockout or tire change is normally fine in a garage."}, {"q": "Do you cover Henderson, North Las Vegas and Boulder City?", "a": "Yes. Our Las Vegas area covers Clark County. Providers who cover your location can quote."}, {"q": "What should I do if I break down in the heat?", "a": "Get off the road if you can, turn on your hazard lights and stay cool and hydrated. If anyone feels unwell from the heat, call 911."}]'),
  ('houston',
   'Roadside help across Houston, from the Loop to the Grand Parkway',
   'Houston is big, and a breakdown on I-45, I-10 or the Beltway can leave you far from home. Heavy rain can also flood streets in minutes. Tell us where you are and what happened, and independent providers across Harris, Fort Bend and Montgomery counties send a price and an arrival time. You decide who comes and pay them directly.',
   array['Downtown and Midtown', 'the Galleria and Uptown', 'the Heights', 'Energy Corridor', 'Katy', 'Sugar Land and Missouri City', 'Cypress', 'Spring', 'The Woodlands', 'Conroe', 'Humble and Kingwood', 'Pasadena', 'Baytown', 'Clear Lake'],
   array['I-45', 'I-10', 'I-69 / US 59', 'I-610 Loop', 'Beltway 8 / Sam Houston Tollway', 'Grand Parkway (SH 99)', 'US 290', 'SH 288', 'Westpark Tollway'],
   array['Never drive into a flooded road. Turn around, find higher ground and request help from there.', 'On the Beltway and other toll roads the shoulders are narrow. If you can, take the next exit before you stop.', 'Tell the provider which side of the freeway you are on and the nearest exit or feeder road. It saves time in Houston traffic.'],
   '[{"q": "Do you cover Katy, Sugar Land and The Woodlands?", "a": "Yes. Our Houston area includes Harris, Fort Bend and Montgomery counties. Providers who cover your location can quote."}, {"q": "My car stalled in high water. Can I get a tow?", "a": "Yes, a tow is the right call: do not try to restart an engine that took in water. If water is still rising around you, call 911 first."}, {"q": "Do tow providers in Texas need a license?", "a": "Yes. Texas tow operators need a license from the Texas Department of Licensing and Regulation (TDLR). We check it before a tow provider can quote."}]')
) as c(slug, headline, intro, areas, highways, tips, faqs) on m.slug = c.slug::extensions.citext
on conflict (market_id, locale) do nothing;

-- Titles and meta descriptions (markets.seo_title / seo_intro) for the same three markets.
update public.markets m set seo_title = c.title, seo_intro = c.descr
from (values
  ('san-antonio', 'Roadside Assistance in San Antonio, TX: Quotes in Minutes', 'Flat tire, dead battery, lockout, fuel or tow in San Antonio, New Braunfels or Boerne? Get price and arrival-time quotes from verified local providers.'),
  ('las-vegas', 'Roadside Assistance in Las Vegas, NV: Quotes in Minutes', 'Stuck on I-15, the Strip or in Henderson? Get price and arrival-time quotes from verified Las Vegas roadside providers and pick the one you want.'),
  ('houston', 'Roadside Assistance in Houston, TX: Quotes in Minutes', 'Broken down on I-45, I-10 or the Beltway? Get price and arrival-time quotes from verified Houston-area providers, from Katy to The Woodlands.')
) as c(slug, title, descr)
where m.slug = c.slug::extensions.citext and m.seo_title is null;
