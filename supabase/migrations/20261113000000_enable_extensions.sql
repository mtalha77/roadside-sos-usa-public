-- RSOS-004: extensions used across the platform.
-- Schema changes happen ONLY through files in supabase/migrations (never in the dashboard).

-- Geography: provider service areas, distance to stranded drivers.
create extension if not exists postgis with schema extensions;

-- gen_random_uuid(), digests and encryption helpers.
create extension if not exists pgcrypto with schema extensions;

-- Case-insensitive text (emails, slugs).
create extension if not exists citext with schema extensions;

-- Scheduled jobs (quote expiry, wallet reconciliation). Supabase installs pg_cron in pg_catalog.
create extension if not exists pg_cron with schema pg_catalog;

-- Durable queues (notifications, provider dispatch).
create extension if not exists pgmq;

-- Outbound HTTP from the database (webhooks to Edge Functions).
create extension if not exists pg_net with schema extensions;
