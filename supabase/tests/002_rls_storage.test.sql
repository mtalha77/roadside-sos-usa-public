-- RSOS-010 sample Row Level Security test: anonymous visitors cannot read or write
-- private storage objects. Pattern for every future table: switch role, try, assert.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(4);

select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'RLS is enabled on storage.objects'
);

set local role anon;

select is_empty(
  $$ select 1 from storage.objects where bucket_id in ('provider-documents', 'job-photos', 'call-recordings') $$,
  'anon sees no private objects'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('provider-documents', 'rls-test/should-fail.pdf') $$,
  '42501',
  null,
  'anon cannot upload to a private bucket'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('job-photos', 'rls-test/should-fail.jpg') $$,
  '42501',
  null,
  'anon cannot upload job photos'
);

reset role;
select * from finish();
rollback;
