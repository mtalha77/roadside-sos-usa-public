-- DEV ONLY (rsos-dev): fake data for development and previews. Never applied to staging or
-- production: only the CI `db` job pushes with --include-seed, and the deploy workflow checks that
-- staging and production contain none of it (supabase/checks/no-fake-data.test.sql).
-- Every fake person is named "Dev Seed ..." and uses fictional 555-01xx numbers.
do $$
declare
  spots constant jsonb := '[
    {"market":"san-antonio","lat":29.4246,"lng":-98.4951,"address":"Dev Seed: downtown test address","service":"flat-tire"},
    {"market":"san-antonio","lat":29.5310,"lng":-98.4900,"address":"Dev Seed: north test address","service":"wont-start"},
    {"market":"houston","lat":29.7600,"lng":-95.3700,"address":"Dev Seed: central test address","service":"tow"},
    {"market":"houston","lat":29.6000,"lng":-95.6200,"address":"Dev Seed: southwest test address","service":"locked-out"},
    {"market":"las-vegas","lat":36.1147,"lng":-115.1728,"address":"Dev Seed: test strip address","service":"out-of-gas"},
    {"market":"las-vegas","lat":36.2000,"lng":-115.2500,"address":"Dev Seed: west test address","service":"flat-tire"}
  ]';
  s jsonb;
  i int := 0;
begin
  if exists (select 1 from public.requests where driver_name like 'Dev Seed%') then
    return; -- already seeded
  end if;
  for s in select * from jsonb_array_elements(spots) loop
    i := i + 1;
    perform public.create_request(jsonb_build_object(
      'market_slug', s ->> 'market',
      'service_slug', s ->> 'service',
      'driver_name', 'Dev Seed Driver ' || i,
      'driver_phone', '+1210555' || lpad((100 + i)::text, 4, '0'),
      'pickup', jsonb_build_object('lat', (s ->> 'lat')::float, 'lng', (s ->> 'lng')::float, 'address', s ->> 'address'),
      'destination', case when s ->> 'service' = 'tow' then jsonb_build_object('lat', 29.79, 'lng', -95.4, 'address', 'Dev Seed: test shop') end,
      'vehicle', jsonb_build_object('year', 2018, 'make', 'Test', 'model', 'Sedan', 'color', 'Gray', 'type', 'car'),
      'situation', jsonb_build_object('safe_spot', true, 'on_highway', false),
      'attribution', jsonb_build_object('utm_source', 'dev-seed', 'landing_page', '/'),
      'consents', jsonb_build_array(jsonb_build_object('type', 'sms_transactional', 'granted', true, 'policy_version', 'dev')),
      'source', 'dev-seed'
    ));
  end loop;

  insert into public.provider_applications (company_name, contact_name, phone, email, market_ids, truck_count, insurance_carrier, referral_source)
  select 'Dev Seed Towing ' || g, 'Dev Seed Owner ' || g, '+1210555' || lpad((150 + g)::text, 4, '0'), 'dev-seed-' || g || '@example.test',
         array[(select id from public.markets where slug = 'san-antonio')], g, 'Dev Seed Insurance', 'dev-seed'
  from generate_series(1, 3) g;

  insert into public.contact_messages (name, email, topic, message)
  values ('Dev Seed Visitor', 'dev-seed-visitor@example.test', 'question', 'Dev seed message: how do quotes work?');

  insert into public.waitlist (email, zip, city, state_code, source)
  values ('dev-seed-waitlist@example.test', '75201', 'Dev Seed City', 'TX', 'dev-seed');
end;
$$;
