# RSOS Batch 3: run report

- Run started: 2026-11-13. No time limit.
- Spec: `docs/batches/rsos-batch-3.md`. Same operating rules as batch 2.
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the first ticket not marked Done.

## Summary

| Ticket                             | Status    | Pull request |
| ---------------------------------- | --------- | ------------ |
| Demo foundation (part of RSOS-098) | In review | (this PR)    |

## Demo mode foundation

- `isDemoMode()` in `@rsos/config/demo`: on when `NEXT_PUBLIC_DEMO_MODE=true` (set for Development and Preview, which includes staging, on all three Vercel projects); always off when `NEXT_PUBLIC_SITE_ENV=production`, whatever the flag says (unit test).
- Fixtures in `@rsos/config/demo-fixtures` (it names cities, so it lives in packages/config): real areas and highways of San Antonio, Las Vegas and Houston; fictional companies, every name ending in "(demo)"; fictional people; 555-01xx numbers.
- Scenario engine in `@rsos/core/demo`: a deterministic stream of demo requests keyed to the wall clock (seeded random numbers), so the website, the provider portal and the admin dashboard show the same requests at the same moment with no server state. Each request moves through searching, quotes arriving over about 3 minutes, picked, en route (truck position and live ETA), on site and completed; some are cancelled or expire. Prices stay inside the market's real ranges when passed in.
- `DemoBadge` ("Demo data", top right) in all three apps in demo mode; `LiteMap`: an SVG map with no provider and no JavaScript, used until a Google Maps key exists.
- "Sign in as demo" on the provider and admin sign-in pages (provider owner, provider operator, super admin, dispatcher). On first use it creates the demo account (reserved `example.com` address, 555 number), its demo company or staff role, signs in and passes the second step on the server (emailed code for providers; an authenticator code computed from a stored secret for admins, in `demo_accounts`, unreadable except by the service role). It throws in production (unit test). The provider project got the server key it needs for this (Preview and staging only), piped from Supabase into Vercel without being displayed.

## BLOCKERS

(carried from batch 2; see `docs/reports/batch-2.md`, items 1 to 15)
