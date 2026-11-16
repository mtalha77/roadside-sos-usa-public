# RSOS Batch 3: run report

- Run started: 2026-11-13. No time limit.
- Spec: `docs/batches/rsos-batch-3.md`. Same operating rules as batch 2.
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the first ticket not marked Done.

## Summary

| Ticket                                                                 | Status                                                     | Pull request                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Demo foundation (part of RSOS-098)                                     | Done                                                       | [#134](https://github.com/mtalha77/roadside-sos-usa-public/pull/134) |
| RSOS-021 Get Help request flow                                         | Done                                                       | [#135](https://github.com/mtalha77/roadside-sos-usa-public/pull/135) |
| RSOS-022 + 065 to 069 Request status, quotes, tracking, cancel, review | Done                                                       | [#136](https://github.com/mtalha77/roadside-sos-usa-public/pull/136) |
| RSOS-029 Ad landing pages                                              | Done                                                       | [#137](https://github.com/mtalha77/roadside-sos-usa-public/pull/137) |
| RSOS-070 Driver account (UI)                                           | Done                                                       | [#138](https://github.com/mtalha77/roadside-sos-usa-public/pull/138) |
| RSOS-019b Provider public profile page                                 | Done                                                       | [#139](https://github.com/mtalha77/roadside-sos-usa-public/pull/139) |
| RSOS-051 Provider app shell                                            | Done                                                       | [#140](https://github.com/mtalha77/roadside-sos-usa-public/pull/140) |
| RSOS-052 Sign-up and onboarding wizard                                 | Done                                                       | [#141](https://github.com/mtalha77/roadside-sos-usa-public/pull/141) |
| RSOS-053 Home: go online                                               | Done                                                       | [#142](https://github.com/mtalha77/roadside-sos-usa-public/pull/142) |
| RSOS-054 Incoming request and one-tap quote                            | Done                                                       | [#143](https://github.com/mtalha77/roadside-sos-usa-public/pull/143) |
| RSOS-055 Active job flow                                               | Done                                                       | [#145](https://github.com/mtalha77/roadside-sos-usa-public/pull/145) |
| RSOS-056 Jobs history and detail                                       | Done                                                       | [#144](https://github.com/mtalha77/roadside-sos-usa-public/pull/144) |
| RSOS-057 Wallet and billing (UI)                                       | Done                                                       | [#146](https://github.com/mtalha77/roadside-sos-usa-public/pull/146) |
| RSOS-058 Services, prices and service area editor                      | Done                                                       | [#147](https://github.com/mtalha77/roadside-sos-usa-public/pull/147) |
| RSOS-059 Public profile editor                                         | Done                                                       | [#148](https://github.com/mtalha77/roadside-sos-usa-public/pull/148) |
| RSOS-060 Team and multi-truck dispatch                                 | Done                                                       | [#151](https://github.com/mtalha77/roadside-sos-usa-public/pull/151) |
| RSOS-061 Performance insights                                          | Done                                                       | [#152](https://github.com/mtalha77/roadside-sos-usa-public/pull/152) |
| RSOS-062 and 063 Notifications, help center and chat                   | Done                                                       | [#153](https://github.com/mtalha77/roadside-sos-usa-public/pull/153) |
| RSOS-093 Account and security in the provider shell                    | Done                                                       | [#154](https://github.com/mtalha77/roadside-sos-usa-public/pull/154) |
| RSOS-071 Admin shell                                                   | Done                                                       | [#155](https://github.com/mtalha77/roadside-sos-usa-public/pull/155) |
| RSOS-034 + 072 Live dispatch board                                     | Done; load test not yet run (admin demo sign-in blocked)   | [#156](https://github.com/mtalha77/roadside-sos-usa-public/pull/156) |
| RSOS-073 Request detail                                                | Done                                                       | [#157](https://github.com/mtalha77/roadside-sos-usa-public/pull/157) |
| RSOS-074 Phone intake console (UI)                                     | Done; timing test not yet run (admin demo sign-in blocked) | [#158](https://github.com/mtalha77/roadside-sos-usa-public/pull/158) |
| RSOS-075 Providers and document review                                 | Done                                                       | [#159](https://github.com/mtalha77/roadside-sos-usa-public/pull/159) |
| RSOS-076 Recruitment pipeline                                          | Done                                                       | [#160](https://github.com/mtalha77/roadside-sos-usa-public/pull/160) |
| RSOS-077 Markets                                                       | Done                                                       | [#161](https://github.com/mtalha77/roadside-sos-usa-public/pull/161) |
| RSOS-078 Pricing and fees                                              | Done                                                       | [#162](https://github.com/mtalha77/roadside-sos-usa-public/pull/162) |
| RSOS-079 Finance (UI)                                                  | Done                                                       | [#163](https://github.com/mtalha77/roadside-sos-usa-public/pull/163) |
| RSOS-080 Reviews and quality                                           | Done                                                       | [#164](https://github.com/mtalha77/roadside-sos-usa-public/pull/164) |
| RSOS-081 Analytics                                                     | Done                                                       | [#165](https://github.com/mtalha77/roadside-sos-usa-public/pull/165) |
| RSOS-082, 083, 084, 094 Content, users, settings, integrations         | Done                                                       | [#166](https://github.com/mtalha77/roadside-sos-usa-public/pull/166) |
| RSOS-098 Walkthrough page and guide                                    | Done; admin part blocked by admin demo sign-in             | (this PR)                                                            |

Admin end-to-end tests are written for every admin screen and run in CI, but they skip while admin "Sign in as demo" is blocked (see BLOCKERS, keys); everything else passes on every pull request.

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

## RSOS-070: Driver account (UI)

Demo data: there are no driver account tables yet, so `/account` exists in demo mode only (404 in production). Quick requests are real: they create a real request in the database.

- Phone-code sign-in (the code is shown on screen in demo mode; stored only as a hash); the demo session is an HttpOnly cookie.
- Tabs: request history (each opens its status page; "Request again"), saved vehicles (default, remove), saved places, favorite providers (linking to their profiles), settings with sign out and delete account (type DELETE to confirm; explains what is kept by law). Saved data is fictional and derived from the phone number, so it is stable.
- Quick request: one tap on a service pre-fills a Get Help draft with the default vehicle and the number; the driver confirms location, answers safety with one tap ("I'm safe, off the road", "on a highway shoulder", "not safe") and sends.

Acceptance criteria:

| #   | Criterion                                                             | Result                                                                                                                                              |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Returning driver can submit a request in 3 taps after location (demo) | PASS: e2e signs in, starts a quick request and counts 2 taps after the location step (safety, send) before landing on the new request's status page |

## RSOS-019b: Provider public profile page

Demo data: demo providers only, in demo mode (marked "Demo provider" on the page); in production the page is hidden (404) until real providers have profiles. Prices are inside the market's real ranges.

- `/providers/[slug]`: generated cover (design tokens, no stock or AI art) and initials logo, city and base area, badges (insurance verified, tow license checked in Texas, typical arrival, rating or "New provider"), services with "from" prices, service area on the LiteMap, hours, payment methods, job photos ("No photos yet": no invented photos), reviews (fictional, demo only) and a Get help button with the market preselected.
- Also fixed while testing RSOS-070: the Get Help handler now resumes at the first unanswered step (a quick request no longer asks again), and request rate limits are higher on demo-mode previews and staging (test suites submit from one IP); production limits are unchanged.

## Part B: provider portal

Sign in on staging: open the provider sign-in page and choose "Sign in as demo" (Provider owner or Provider operator). The demo company is the first fictional San Antonio provider.

Shared data layer: `demoPortal` in `@rsos/core/demo` gives the portal's view of the same live stream the website and admin use: incoming offers (requests still taking quotes in the company's market, with distance and drive time), live jobs, a stable 60-day job history, wallet ledger, team and weekly insights, all priced with the market's real ranges and fees. Real data in the portal: the company, the member's role, the wallet balance (`provider_wallets`, owner and manager only), market prices and fees, and account and security.

## RSOS-051: Provider app shell

- Installable web app: `manifest.webmanifest` (standalone, portrait, brand icons, dark theme colour), a service worker that keeps an offline page and shows "A new version is ready. Update now" when an update is waiting, and a connection banner when the phone goes offline.
- Navigation: bottom tabs on phones (Home, Jobs, Wallet, Profile, More; operators don't get Wallet), side navigation on desktop for office staff; a More page on phones for everything else; skip link.
- Dark mode by default at night (7 pm to 7 am local time) unless the provider chose a theme; switches back in the morning only if it switched automatically.
- Install guide for iPhone and Android (`/install`).
- The existing home and the account and security page (RSOS-093) now sit inside the shell.

## RSOS-051 follow-ups (fixed before merge)

- Demo companies are now marked (`providers.is_demo`) and never counted in the website's live proof (`market_public_stats`); a pgTAP test covers it.
- The manifest is linked only on staging and production: protected preview deployments answered WebKit's manifest request (sent without the preview cookie) with an endless redirect. The service worker is skipped in automated browsers for the same reason, and answers only offline page loads.
- Navigation lists only screens that exist (`apps/provider/src/lib/routes.ts`); each Part B ticket adds its own.

## RSOS-052: Sign-up and onboarding wizard

Demo data, except the market price ranges (real, `market_services`). Answers are kept on the device until the backend batch wires saving.

- Nine steps with a progress tracker, saved after each step and resumed on return; "what happens next" and the in-review state at the end. Document steps use the camera on phones and ask for expiry dates.

| #   | Criterion                                                  | Result                                                                                                                                          |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Complete in under 15 minutes on a phone (timed, demo data) | PASS: e2e completes all nine steps on the mobile projects, including a reload to prove resume, and asserts the elapsed time is under 15 minutes |

## RSOS-053: Home, go online

Real: company, role, wallet balance and its low-balance warning, in-review blocker. Demo: today's stats, requests nearby on the map, the expiring-document blocker.

- Big Go Online toggle (kept on the device), truck or operator choice, service-area map with nearby requests, today's stats, wallet card, blockers with one-tap fixes.

## RSOS-054: Incoming request and one-tap quote

Demo: the offers (the shared demo stream for the company's market). Real: price ranges and fees.

- Full-screen offer with sound and vibration, countdown ring, service and vehicle, distance and drive time, approximate map (exact address hidden until picked), tow miles, situation flags, pre-filled quote (your price, our fee, what the driver pays), one-tap Send, adjust price and ETA within limits, decline with a reason, stacked offers; then waiting, "You were picked" or "Driver chose another provider".

| #   | Criterion                                         | Result                                                                |
| --- | ------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Alert to sent quote in 1 tap with defaults (demo) | PASS: e2e opens the offer and sends the pre-filled quote with one tap |

## RSOS-056: Jobs history and detail

Demo data, priced with the market's real ranges and fees.

- Tabs Active, Won, Lost or missed, Cancelled; service filter; "Show more" paging (server-rendered, no client JavaScript); job detail with timeline, price, fee charged, driver and vehicle, operator, photos, review and a fee dispute button.

Fixed while shipping RSOS-054 (found by the provider e2e suites running in parallel):

- "Sign in as demo" reset the demo account's password on every use, and a password change signs out every other session of the account, so people (and parallel tests) sharing a demo account signed each other out. The password is now reset only when signing in with it fails.
- The offer countdown showed wall-clock seconds in the server render and again in the browser (React hydration error 418); it now renders in the browser only, with a same-size placeholder first.
- End-to-end expectations wait up to 15 s (cold preview deployments, WebKit on CI).

## RSOS-055: Active job flow

Demo data (job progress and photos are kept on the device).

- One large button per step (Start driving, I've arrived, Start the work, Job completed), deep links to Google Maps, Apple Maps and Waze, masked call and text (demo number from `packages/config`), before and after photos with the camera, report an issue, cancel with a reason, assign to an operator.

## RSOS-057: Wallet and billing (UI)

Real: the balance (`provider_wallets`). Demo: transactions, payment method. Placeholders: card payment (needs Stripe keys), plan prices (need a pricing decision).

- Big balance, top-up sheet (presets 100, 250, 500 and other amount), auto-recharge settings, payment methods, transactions grouped by day linked to their jobs, statement download (CSV), Pro and Featured plan cards with comparison. Owners and managers only.

## RSOS-058: Services, prices and service area editor

Real: market ranges and fees. The company's own prices, radius, hours and budget are kept on the device until saving is wired.

- Price per service with the market range and what the driver sees; prices outside the range are flagged and block saving; radius slider on the map; working hours; daily request budget with a hard limit.

## RSOS-059: Public profile editor

Demo data (company name and rating from the demo company).

- Photos, description, hours, payment methods and trucks shown; live preview of the profile card and the quote drivers see; profile strength meter with tips.

## RSOS-060: Team and multi-truck dispatch

Real: the member's role. Demo: team members, truck positions, assignments.

- Live team map, members with roles and online state, invite by text (name, number, role), managers assign active jobs; operators see only jobs assigned to them.

## RSOS-061: Performance insights

Demo data.

- Quote rate, win rate, reply time, ETA accuracy, rating, cancellations; return on fees by week (job value won against fees paid) as a server-rendered SVG chart with an equivalent data table for screen readers.

## RSOS-062 and 063: Notification settings, help center and chat

Demo data (settings are kept on the device; dispatch replies are simulated).

- Alert channels (push, text, voice backup), sound choice with a test alert (sound and vibration), quiet hours; searchable help articles (plain form, works without JavaScript); chat with dispatch linked to a job.

## RSOS-093: Account and security inside the provider shell

Real data (batch 2 account and security).

- The page now uses the portal's page layout and heading, sits inside the shell with the navigation, and passes axe in light and dark at phone and desktop widths with no horizontal scroll (new e2e with screenshots in both themes).

| #   | Criterion                                 | Result                                                                                                                                  |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fits the shell and passes the quality bar | PASS: e2e on iPhone, Pixel and desktop: navigation present, zero serious or critical axe issues in light and dark, no horizontal scroll |

Fixed while shipping RSOS-093: the account page listed every signed-in device, and shared demo accounts collect many; it now lists the current device and the 9 most recent, with a count of the rest.

## Part C: admin dashboard

Sign in on staging: open the admin sign-in page and choose "Sign in as demo" (Super admin or Dispatcher). The second step is passed on the server for demo accounts.

## RSOS-071: Admin shell

Real: the signed-in staff member and role, the markets list. Demo: nothing (the shell itself).

- Collapsible sidebar (only sections that exist are listed; each ticket adds its own), market switcher (one, several or all; remembered in a cookie and applied by every screen), Cmd+K / Ctrl+K command palette (jump to a page; find a request by code, phone or name; find a provider; switch theme; show shortcuts), "g then a letter" shortcuts with a "?" cheat sheet, light and dark, skip link, section links on phones.
- Hidden Demo controls (demo mode only) in the sidebar: pause, resume, skip ahead 5 minutes and reset the scenario clock that drives the simulated requests on admin screens. Real data is never touched.
- Saved views on tables use `useSavedViews` from the UI kit where tables use DataTable; the admin tables in this batch are server-rendered with URL filters, so a filtered view is saved by bookmarking its link.
- The shared command palette gained an optional `onQueryChange` so actions can use what was typed.

## RSOS-034 + RSOS-072: Live dispatch board

Real: requests from the Get Help form (`admin_live_requests`, a security-invoker function, so staff market policies apply; migration `20261115000000_admin_board.sql`, pgTAP `017_admin_board.test.sql`). Demo: requests from the shared scenario stream (labelled "Demo"), truck positions, supply.

- Split view: live map (requests coloured by SLA, trucks en route) and lanes (new, quoting, picked, en route, on site), polling every 2 seconds.
- SLA timers on cards: amber after 2 minutes without a quote, red after 3, with a short sound when a card turns red.
- Card actions: call driver or provider (softphone placeholder), push to more providers, assign manually, note, cancel; each card opens the request page.
- Supply panel: online providers per market and area, gaps highlighted.
- Demo controls' scenario clock applies here; a "Load test: 200 demo requests" switch packs the stream.

| #   | Criterion                                      | Result                                                                                                                                                                                                                    |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Real Get Help requests appear within 2 seconds | PASS by design: the board polls `/api/board` every 2 s and reads real requests on every poll (RSOS-021 criterion 3). Not yet exercised end to end on CI: admin demo sign-in is blocked (BLOCKERS, keys)                   |
| 2   | Handles 200 live demo requests without lag     | WRITTEN, NOT YET RUN: the e2e turns on the load test, expects at least 150 open requests and under 600 ms of blocking time over 6 s of live updates on Chromium; it skips until admin demo sign-in works (BLOCKERS, keys) |

## RSOS-073: Request detail

Real: requests, their timeline (`request_events`), attribution and fee, searchable by code, phone or name. Demo: simulated requests (quotes with times, chosen provider, timeline). Placeholders: calls, recordings and texts (need Twilio), review and disputes (no tables yet).

- `/requests` search and table; `/requests/[id]` full page with driver inputs, map, quotes, chosen provider, timeline, attribution, fee, notes and actions with an action log. The dispatch board's cards link here; the side panel is the board card itself.

## RSOS-074: Phone intake console (UI)

Demo: the incoming call, caller history, the created request (simulated until phone service exists; real phone requests need Twilio, BLOCKER).

- Softphone panel (answer, decline, hold, mute, transfer, hang up, availability), screen pop with the caller's past requests, guided intake form, "Text a location link", and a timer from answering to the created request.

| #   | Criterion                                 | Result                                                                                                                                                                    |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phone request created in under 90 seconds | WRITTEN, NOT YET RUN: the e2e answers a demo call, fills the form and creates the request, asserting under 90 s; it skips until admin demo sign-in works (BLOCKERS, keys) |

## RSOS-075: Providers and document review

Real: provider companies (name, status, markets). Demo: the demo directory, trucks, ratings, documents, performance, team and actions (simulated, logged on the page).

- Table with search and status filter, map view, review queue with each company's documents side by side (approve or request changes with a reason), provider detail with stats, team, area, documents, recent jobs and reviews, and actions (approve, pause, suspend, credit, message, view as provider) plus notes.

## RSOS-076: Recruitment pipeline

Real: leads from `provider_applications` (the For Providers form). Demo: demo leads. Placeholder: the coverage target (12 live providers per market, in `packages/config`).

- Board and table (lead, contacted, interested, onboarding, live, lost) per market, stage changes, follow-up reminders, CSV import with a preview count, coverage progress per market.

## RSOS-077: Markets

Real: markets, boundaries (`admin_market_shapes`, migration `20261115010000_admin_markets.sql`, pgTAP `018`), time zone, coverage hours, phone numbers, services count. Demo: the coverage heatmap.

- Market list and detail with the boundary on a map, settings, phone numbers by source, rules and a launch checklist. Drawing a new boundary needs the Google Maps key (BLOCKER).

## RSOS-078: Pricing and fees

Real: ranges, fees and price history from `market_services`. Placeholders: Pro discount and featured slot price (decision), the scheduled-change approval (kept on the page until writes are wired).

- Per market and service: driver price range, our fee, Pro fee, featured slot, effective date; history of earlier prices; schedule a change with an effective date and a super admin approval step.

## RSOS-079: Finance (UI)

Demo data (no billing yet). Placeholder: Stripe reconciliation (needs Stripe).

- Totals for fees, top-ups, credits and subscriptions; ledger explorer with type filter; revenue by market, service and source; disputes queue; CSV export (finance and super admins).

## RSOS-080: Reviews and quality

Demo data (no reviews table yet).

- Moderation queue with the lowest ratings first (approve, hide, follow up with the driver), provider quality scores with thresholds (rating below 4.3 or cancellations above 8% are flagged).

## RSOS-081: Analytics

Real: the request count in the range. Demo: the funnel, sources and speed, scaled from the live demo stream. Placeholder: unit economics assumptions in `packages/config` (cost per click, conversion rates, fee share) until the owner's model is shared (BLOCKER, decisions).

- Date ranges (today, 7 and 30 days); funnel (visits, started, submitted, quoted, picked, completed) with step conversion; requests by source; time to first quote; economics (ad spend, cost per paid request, fee revenue, contribution).

## RSOS-082, 083, 084, 094: Content, users, settings, integrations

Real: city page intros (edit, preview and publish through `admin_update_market_intro`, super admins and operations managers only, audited; migration `20261115020000_content.sql`, pgTAP `019`), staff list and roles, the audit log (super admins). Demo or placeholders: message templates (English and Spanish, with a filled-in preview), business rules, feature flags, integrations (not connected until accounts exist).

## RSOS-098: Staging walkthrough page and guide

- `docs/WALKTHROUGH.md`: how to sign in as demo, every screen of the three apps in the order a real job happens, and what is real or demo.
- Admin `/walkthrough` (demo mode only; 404 in production), linked from the admin sidebar next to Demo controls: driver, provider and admin steps with direct links to the staging apps (addresses come from the app URL settings, the city link from the database).
- "Run full demo": resets the admin scenario clock and opens one fresh demo job in the driver's view, the provider portal and the admin request page at once (with the three links as a fallback if the browser blocks extra tabs). The job plays out over about 18 minutes; Demo controls can pause or skip ahead.

| #   | Criterion                                                                                     | Result                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Following the walkthrough, the owner sees a full job from request to review in all three apps | PARTLY BLOCKED: the website and provider portal parts work on staging; the admin part needs admin "Sign in as demo", which is blocked by the admin server key (BLOCKERS, keys). The walkthrough e2e is written and skips until then |

## BLOCKERS

New in batch 3 (keys):

- Admin "Sign in as demo" cannot reach Supabase on previews and staging: the admin project's server key (`SUPABASE_SERVICE_ROLE_KEY` in Vercel project rsos-admin, Preview, plus its staging-branch override) is rejected before it reaches Supabase Auth, so the demo staff account cannot be created. The provider project's key works. `/api/health` on the admin now reports `demoSignIn: "unavailable"` while this is wrong, and the admin end-to-end tests skip with a note instead of failing. Replacing the key was blocked by this session's safety settings.

(carried from batch 2; see `docs/reports/batch-2.md`, items 1 to 15)
