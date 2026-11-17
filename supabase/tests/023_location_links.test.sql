-- RSOS-023: location links through definer functions; expired links do nothing. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

insert into public.requests (id, short_code, market_id, platform_fee_cents, status, channel, driver_name, driver_phone)
values ('00000000-0000-4000-8000-0000000005c1', 'R-LNK2', (select id from public.markets where slug = 'houston'), 0, 'phone_intake', 'phone', 'Caller', '+12105550151');
insert into public.location_links (token, request_id) values
  ('valid_token_abcdefghijklmn', '00000000-0000-4000-8000-0000000005c1');
insert into public.location_links (token, request_id, expires_at) values
  ('expired_token_abcdefghijkl', '00000000-0000-4000-8000-0000000005c1', now() - interval '1 minute');

set local role anon;
select throws_ok($$ select * from public.location_links $$, '42501', null, 'visitors cannot read links directly');
select is((select valid from public.get_location_link('valid_token_abcdefghijklmn')), true, 'a fresh link is valid');
select is((select valid from public.get_location_link('expired_token_abcdefghijkl')), false, 'an expired link is not');
select is_empty($$ select * from public.get_location_link('short') $$, 'short or unknown tokens find nothing');
select is(public.submit_location('expired_token_abcdefghijkl', 29.76, -95.37, 'Nope'), false, 'an expired link cannot move the request');
select throws_ok($$ select public.submit_location('valid_token_abcdefghijklmn', 51.5, 0.1, 'London') $$, '22023', null, 'points outside the US are refused');
select is(public.submit_location('valid_token_abcdefghijklmn', 29.761, -95.369, 'Near the exit', 'White pickup'), true, 'a valid link updates the location');
reset role;
select is((select pickup_address from public.requests where id = '00000000-0000-4000-8000-0000000005c1'), 'Near the exit', 'the address is saved');
select is((select count(*)::int from public.request_events where request_id = '00000000-0000-4000-8000-0000000005c1' and event_type = 'location_shared'),
  1, 'and the timeline records it');

select * from finish();
rollback;
