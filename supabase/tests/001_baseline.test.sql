-- RSOS-004 baseline: extensions and storage buckets exist with the right visibility.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(10);

select has_extension('postgis', 'postgis is installed');
select has_extension('pgcrypto', 'pgcrypto is installed');
select has_extension('citext', 'citext is installed');
select has_extension('pg_cron', 'pg_cron is installed');
select has_extension('pgmq', 'pgmq is installed');
select has_extension('pg_net', 'pg_net is installed');

select is((select public from storage.buckets where id = 'provider-documents'), false, 'provider-documents is private');
select is((select public from storage.buckets where id = 'provider-media'), true, 'provider-media is public');
select is((select public from storage.buckets where id = 'job-photos'), false, 'job-photos is private');
select is((select public from storage.buckets where id = 'call-recordings'), false, 'call-recordings is private');

select * from finish();
rollback;
