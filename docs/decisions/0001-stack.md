# 0001: Stack

- Status: accepted
- Date: 2026-11-10

## Context

Three web apps (public website, provider portal, admin dashboard) that share UI, business rules and
data, built by a very small team that needs speed, type safety and low operations work.

## Decision

Turborepo + pnpm monorepo; Next.js App Router with strict TypeScript; Tailwind CSS with shadcn/ui on
Radix; React Hook Form + Zod; TanStack Query and Table; Supabase (Postgres + PostGIS, Auth, Realtime,
Storage, Edge Functions); Vercel; Google Maps, Twilio, Stripe, Resend, Sentry, PostHog; next-intl;
Vitest, Playwright, Storybook. Versions pinned exactly.

## Consequences

One language end to end and shared packages. Vendor coupling to Vercel and Supabase is accepted for
speed; keeping business logic in `packages/core` limits lock-in.
