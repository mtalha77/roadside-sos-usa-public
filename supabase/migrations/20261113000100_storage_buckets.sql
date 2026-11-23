-- RSOS-004: storage buckets. Access policies on storage.objects are added with the features
-- that use each bucket; until then private buckets deny all access (RLS is on by default).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Licences, insurance and ID documents for provider verification. Private.
  ('provider-documents', 'provider-documents', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  -- Provider logos and truck photos shown on quotes. Public.
  ('provider-media', 'provider-media', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  -- Photos of the vehicle or scene attached to a request. Private.
  ('job-photos', 'job-photos', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  -- Recorded calls between drivers and providers. Private.
  ('call-recordings', 'call-recordings', false, 52428800,
    array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
