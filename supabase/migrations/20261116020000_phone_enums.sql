-- RSOS-030 and RSOS-034b: new enum values, in their own migration because Postgres cannot use a
-- value in the same transaction that adds it.

-- Call tracking sources (the tracking number's purpose).
alter type public.phone_purpose add value if not exists 'gmb';
alter type public.phone_purpose add value if not exists 'bing';
alter type public.phone_purpose add value if not exists 'staging_test';

-- Phone intake and manual dispatch steps:
-- new (submitted or phone_intake) -> contacted -> location_confirmed -> assigned -> en_route ->
-- on_site -> completed, or cancelled / no_provider.
alter type public.request_status add value if not exists 'phone_intake' before 'submitted';
alter type public.request_status add value if not exists 'contacted' after 'quoted';
alter type public.request_status add value if not exists 'location_confirmed' after 'contacted';
alter type public.request_status add value if not exists 'assigned' after 'location_confirmed';
alter type public.request_status add value if not exists 'no_provider' after 'expired';
