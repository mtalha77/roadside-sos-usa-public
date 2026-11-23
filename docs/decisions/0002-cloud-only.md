# 0002: Cloud only (no local database)

- Status: accepted
- Date: 2026-11-12

## Context

Docker and local Supabase stacks are slow to set up and drift from the real environments.

## Decision

All databases are Supabase cloud projects (`rsos-dev`, `rsos-staging`, `rsos-prod`). Schema changes
are migration files applied by CI: pull requests to `rsos-dev`, merges to staging and production.
Apps run on Vercel; local development points at `rsos-dev`.

## Consequences

Onboarding needs only Node and pnpm. Pull requests share `rsos-dev`, so migrations must be additive
and idempotent where possible; the CI `db` job serializes runs.
