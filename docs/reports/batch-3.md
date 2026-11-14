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

## RSOS-021: Get Help request flow

Real data: every screen saves to the database (no demo data).

- One question per screen with a progress bar and Back link: location, problem (with a follow-up per service), destination (tow and winch out only), vehicle, safety, contact, code. Each answer is validated and merged into a draft in `request_drafts` (migration `20261114010000_request_flow.sql`; read and written only through definer functions, by an unguessable token in an HttpOnly cookie), so a reload or a lost connection resumes at the same step. pgTAP `015_request_flow.test.sql` (8).
- Plain HTML forms posting to `/api/get-help`: the flow works without JavaScript and keeps `/get-help` within the 150 KB budget. Only "Use my location" (GPS) and the final Turnstile check use script.
- Location: GPS with the market found by the database boundary check (outside every market: waitlist and city picker), or a typed address plus city when location is denied or unavailable (focus moves to the address field). Landmark or mile-marker note. Without a Google Maps key there is no map pin or address search (BLOCKER 4 from batch 2 covers the key).
- Problem follow-ups: spare available, keys inside or lost, fuel type, clicking or nothing; destination with distance range (the price includes distance); vehicle type, make (searchable list), model, color, optional year, EV; safety (safe place, highway, passengers); choosing "not safe" shows "call 911 first" with a call button, with no script (CSS `:has`).
- Contact and code: a 6-digit code sent through the SMS interface (rate limited per IP and per phone; the code is stored only as a hash; 5 wrong codes start the number over). In demo mode the code is shown on screen; where texts are unavailable the request is sent unverified and the team confirms by phone.
- Submit: Turnstile (test keys), a per-IP limit, a duplicate check (the same phone within 30 minutes opens the existing request), then `submit_web_request` creates the request with attribution (UTM and click IDs from the landing URL, referrer, device) and three consents (driver terms, privacy, SMS) with their policy versions, records whether the phone was verified, deletes the draft and opens `/r/[token]`.

Acceptance criteria:

| #   | Criterion                                                | Result                                                                                                                              |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | First-time user completes in under 60 seconds on a phone | PASS: e2e fills every step on iPhone, Pixel and desktop profiles and asserts under 60 s from opening `/get-help` to the status page |
| 2   | Denied location falls back smoothly                      | PASS: e2e denies location; the message appears, focus moves to the address field and the flow continues                             |
| 3   | Request appears in admin within 2 seconds                | Covered with the dispatch board (RSOS-034), which reads `requests` and refreshes every 2 seconds                                    |

## RSOS-022 + RSOS-065 to 069: request status, live quotes, selection, tracking, cancel, review

Real vs demo: the request, its stage, cancelling and problem reports are real (database). Quotes, providers, truck movement and reviews are demo (no provider matching or reviews tables yet): in demo mode a real request gets simulated providers, clearly labelled "Demo providers", seeded by its token so every reload and every app shows the same ones; demo tokens play the shared scenario. In production a real request shows only its real stage.

- One page, `/r/[token]`, through every stage: finding providers (countdown ring, reassurance, call button with the market number); live quotes (cards slide in, sort fastest or cheapest, "Get help fastest" auto-pick, provider profile sheet, a polite screen-reader announcement per new quote); confirm sheet (price, ETA, what's included, extra-charge rules, "You pay the provider directly", accepted methods; a second tap is ignored); tracking (LiteMap with the truck moving, live ETA, provider card, call and text through a private number, status steps, share link, safety tips); completed (1 to 5 stars, tags, comment, receipt-style summary); cancelled and expired (friendly message and a new request link); unknown token (friendly page with the support number).
- Cancel with a reason at any stage before arrival (`cancel_request_by_token`, migration `20261114020000_request_actions.sql`, the reason recorded in the request timeline; pgTAP `016_request_actions.test.sql`, 4). Report a problem (no-show, overcharge, damage, safety) goes to the team's contact messages with the request code.
- The driver's pick is kept across reloads; real requests poll their status every 4 seconds.
- The demo engine now takes the driver's own pick (which quote, when) and seeds real requests from their token.

Acceptance criteria:

| #   | Criterion                                               | Result                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All stages reachable in demo                            | PASS: e2e finds live demo requests in each stage through the shared engine and opens them (searching, quoting, en route, on site, completed, cancelled, expired), plus choosing a quote moves the page to tracking, and cancel with a reason |
| 2   | Real requests from RSOS-021 show the correct real stage | PASS: the Get Help e2e lands on `/r/[token]` of the new real request, which shows "Finding providers" (its real stage, then simulated providers in demo mode)                                                                                |
| 3   | Every stage has mobile and desktop screenshots          | PASS: the e2e saves a full-page screenshot per stage on iPhone, Pixel and desktop profiles (Playwright report artifact of each run)                                                                                                          |

## RSOS-029: Ad landing pages

Real data: market, number, prices and services from the database; the form starts the real request flow.

- `/lp/[market]/[service]`: no menu; the brand and a tap-to-call button at the top, a large Call now button and a sticky call bar on phones (when the market has a number); a headline chosen by `?h=` from an allowed list (`fast`, `price`, `local`, `stuck`; anything else falls back, so an ad cannot put its own text on the page); the first request step on the first screen ("Use my location" or an address in that city) posting into the Get Help flow with market, service, landing page and the ad's click IDs and UTM tags kept for attribution; trust row; the local price range; other service tiles; 3 FAQs. `noindex`, and an unknown market or service is a 404.
- Server rendered; the only script is "Use my location".
- Added to the Lighthouse CI run (the first city and service found in the sitemaps).

Acceptance criteria:

| #   | Criterion                    | Result                                                                         |
| --- | ---------------------------- | ------------------------------------------------------------------------------ |
| 1   | LCP under 1.2 seconds mobile | MEASURED on staging after merge (see below)                                    |
| 2   | JavaScript under 150 KB      | PASS in CI: the landing page is part of the Lighthouse budgets (150 KB script) |

### Run notes (CI and staging)

- Staging database deploys had been failing since the end of batch 2: the batch 2 release check ran the e2e suite against the staging branch, which uses the staging database, and its form tests left 6 test provider applications and 6 test contact messages (all `@example.test`). The no-fake-data guard caught it. Those 12 rows were deleted (they were the only rows in those tables), and e2e tests that write data now skip on release checks (`E2E_READ_ONLY` when the pull request comes from `staging`).
- The Playwright report (with the mobile and desktop screenshots of every screen) is now uploaded on every run, not only on failure.
- Lighthouse total blocking time: GitHub's shared runners measured 215 to 244 ms on pages this batch did not change, while staging measures 24 to 66 ms. The CI limit is now 300 ms with a median of five runs; the 200 ms target (the lab proxy for INP) is checked against staging.
- One database job failed once with "Invalid access token" from Supabase and passed on re-run.

## BLOCKERS

(carried from batch 2; see `docs/reports/batch-2.md`, items 1 to 15)
