# RSOS Batch 3: front end across all three apps

Project: Roadside SOS USA (working name). Test domain: fixallcontractors.com.
Repository: github.com/mtalha77/roadside-sos-usa
Project folder on this Mac: /Users/mtalha/Claude/roadside-sos-usa

Goal of this batch: the owner can open staging and click through every main screen of all three apps (driver website, provider portal, admin dashboard) as a realistic, polished product. Where the backend is not built yet, screens run on demo data through a clean data layer, so wiring the real backend later changes the data source, not the screens.

Prerequisite: batch 2 is merged into `staging` (design system, schema v1, sign-in, website pages). If a batch 2 ticket is blocked, work around it where possible and note it.

Read this whole file before starting.

---

## Operating rules

1. Copy this file into the repo as `docs/batches/rsos-batch-3.md` in your first pull request.
2. Same rules as batch 2 (`docs/batches/rsos-batch-2.md`): one branch and pull request per ticket into `staging`, zero errors and warnings, CI green, squash-merge yourself, never touch `main`, no questions, blockers recorded, cloud only, no hardcoded brand, domain, phone or city, secrets never printed, `caffeinate -dims &` during the run.
3. Run report: `docs/reports/batch-3.md`, updated after every ticket. For each screen, list what is real (connected to the database) and what is demo data.
4. If context resets: re-read this file, CLAUDE.md and the run report, then continue from the first unfinished ticket.
5. If a ticket fails CI three times for the same unfixable reason, mark it BLOCKED and continue.
6. Keep going until every ticket is done or blocked. No time limit.

## Demo data rules (important)

- Build one data layer per domain in `packages/core` and `packages/db` (requests, quotes, providers, jobs, wallet, markets, analytics). Each has a real Supabase implementation where tables exist, and a demo implementation with realistic fixtures.
- Demo fixtures: realistic US data for San Antonio, Las Vegas and Houston (real street areas and highways, plausible names, vehicles, prices within the seeded ranges, ETAs). Clearly fictional company names. No real people or companies.
- A `DEMO_MODE` environment flag turns demo data on. It is ON for Development, Preview and Staging, and OFF and impossible to enable in Production (enforced in code and tested).
- When demo mode is on, show a small, tasteful "Demo data" badge in each app's corner.
- Live simulation in demo mode: a scenario engine that plays timed events (new request arrives, quotes come in over 3 minutes, provider moves on the map, status changes) so screens feel alive. Admin has a hidden "Demo controls" panel (only in demo mode) to start, pause and reset scenarios.
- Demo sign-in on staging and previews only: a "Sign in as demo" option on provider and admin sign-in pages with roles (provider owner, provider operator, admin super admin, dispatcher). It uses seeded demo accounts in `rsos-dev` and `rsos-staging`. It must not exist in production (test proves it).
- Real data wins: if a table and real rows exist (markets, services, prices, fees, provider applications, contact messages, requests from the real Get Help form), screens show them.

## Quality bar

Same as batch 2: "calm under stress" design, references Uber, Uber Driver, DoorDash Dasher, Thumbtack Pro, Jobber, Cash App, Linear, Stripe Dashboard, Onfleet, Intercom (patterns and polish only, never copied). 375px and 1440px, light and dark, keyboard usable, 48px touch targets, zero axe serious or critical issues, zero console errors, smooth 60fps animations, skeletons instead of spinners, optimistic updates, empty, loading and error states for every screen. Playwright test and screenshots (mobile and desktop) for every screen, attached to each pull request.

---

## Part A: driver website (apps/web)

### RSOS-021 Get Help request flow

Real, saving to the database (schema from RSOS-016).

- One decision per screen with progress bar, back button, and state saved if the page reloads:
  1. Location: "Use my location" with a draggable map pin, or address search; reverse-geocoded address shown; landmark or mile marker note; market detection; outside markets shows the waitlist.
  2. Problem: 6 service tiles with short follow-ups (flat tire: spare available; locked out: keys inside or lost; out of gas: fuel type; won't start: lights on or clicking).
  3. Tow and winch out only: destination search with distance.
  4. Vehicle: type, make and model (searchable list), color, year optional, EV flag.
  5. Safety: safe place, on highway, passengers; unsafe shows "call 911 first" advice.
  6. Contact: name, mobile, 6-digit SMS code (mock code shown in demo mode), consent text with links to terms and privacy.
  7. Submit: creates the request with attribution and consent; goes to the status page.
- Turnstile (test keys), rate limit, duplicate check (same phone within 30 minutes opens the existing request).
- Without a Google Maps key, location uses browser GPS plus a clean manual address form; record the BLOCKER once.
  Acceptance: first-time user completes in under 60 seconds on a phone; denied location falls back smoothly; request appears in admin within 2 seconds.

### RSOS-022 + RSOS-065 to 069 Request status, live quotes, selection, tracking, cancel, review

One page `/r/[token]` that moves through all stages (demo scenario engine drives quotes and movement):

- Finding providers: calm animation, countdown ring, reassurance text, call button.
- Live quotes: QuoteCards slide in; sort fastest or cheapest; tap opens provider profile sheet; "Get help fastest" auto-pick toggle; screen reader announces new quotes.
- Confirm sheet: provider, price, ETA, what's included, extra-charge rules (tow mileage, waiting), "You pay the provider directly" with accepted payment methods; double-tap safe.
- Tracking: full map with moving truck, live ETA, provider card, masked call and text buttons, status steps, share tracking link, safety tips.
- Cancel with reason at any stage; report a problem (no-show, overcharge, damage, safety).
- Completed: rating 1 to 5, tags, written review, receipt-style summary.
- Expired or invalid token: friendly message with support number.
  Acceptance: all stages reachable in demo; real requests from RSOS-021 show the correct real stage; every stage has mobile and desktop screenshots.

### RSOS-029 Ad landing pages

- `/lp/[market]/[service]`: no menu, big tap-to-call, headline from an allowed list by URL parameter, service tiles, first request step on the first screen, trust row, price range, 3 FAQs; `noindex`.
  Acceptance: LCP under 1.2 seconds mobile; JavaScript under 150 KB.

### RSOS-070 Driver account (UI)

- Phone-code sign-in, saved vehicles and places, request history, favorite providers, delete account. Demo data where tables do not exist.
  Acceptance: returning driver can submit a request in 3 taps after location (demo).

### RSOS-019b Provider public profile page

- `/providers/[slug]`: logo, cover and job photos, services with prices, service area map, hours, payment methods accepted, badges, rating and reviews, typical ETA. Demo providers in demo mode only; hidden in production until real providers exist.

---

## Part B: provider portal (apps/provider), installable web app

Benchmark: Uber Driver and DoorDash Dasher for speed and clarity, Thumbtack Pro for pricing and profile, Jobber for job flow, Cash App for wallet.

### RSOS-051 App shell

- Installable app (manifest, icons, splash, update prompt), offline screen, connection banner.
- Mobile bottom tabs: Home, Jobs, Wallet, Profile, More; desktop side navigation for office staff.
- Dark mode default at night; install guide for iPhone and Android.

### RSOS-052 Sign-up and onboarding wizard

- Steps saved and resumable: account, company, services and prices (market range shown beside each), service area map (radius or drawn), trucks and team, documents (photo capture, expiry dates), public profile, wallet setup, agreements.
- Progress tracker and "what happens next" screen; in-review state.
  Acceptance: complete in under 15 minutes on a phone (timed with demo data).

### RSOS-053 Home: go online

- Big Go Online toggle (swipe to go offline), choose truck or operator, map with service area outline, today's stats (requests, quotes sent, jobs won, job value, fees paid), wallet balance with low-balance warning, blockers (empty wallet, expired document, in review) with one-tap fixes.

### RSOS-054 Incoming request and one-tap quote

- Full-screen offer with sound and vibration, countdown ring, service and vehicle, distance and drive time, mini map (exact address hidden until picked), tow miles, situation flags, pre-filled quote (your price, our fee, driver total), one-tap Send, adjust price and ETA within limits, decline with reason.
- After sending: waiting state, "You were picked" celebration or "Driver chose another provider"; stacked offers.
  Acceptance: alert to sent quote in 1 tap with defaults (demo scenario).

### RSOS-055 Active job flow

- Steps with large buttons: Start driving (deep links to Google Maps, Apple Maps, Waze), Arrived, Working, Completed with before and after photos, Report issue, Cancel with reason; masked call and text; assign to operator.

### RSOS-056 Jobs history and detail

- Tabs Active, Won, Lost or missed, Cancelled; filters; job detail with timeline, photos, price, fee charged, review, dispute button; infinite scroll.

### RSOS-057 Wallet and billing (UI)

- Big balance, top-up sheet (preset 100, 250, 500 and custom; Stripe Payment Element placeholder until keys), auto-recharge settings, payment methods, transactions grouped by day linked to jobs, dispute a fee, statements download, Pro and Featured plan cards with comparison. Owner and manager only.

### RSOS-058 Services, prices and service area editor

- Price per service with market range and driver-facing all-in preview; service area map editor; working hours; daily request budget; warnings and hard limits.

### RSOS-059 Public profile editor

- Edit photos, description, hours, payment methods, trucks shown; live preview of profile page and QuoteCard; profile strength meter with tips.

### RSOS-060 Team and multi-truck dispatch

- Invite operators by SMS, roles, live team map, manager assigns jobs; operator view shows only assigned jobs.

### RSOS-061 Performance insights

- Quote rate, win rate, reply time, ETA accuracy, rating, cancellations; return on fees (job value won vs fees paid) by week and month; charts.

### RSOS-062 and 063 Notification settings, help center and chat

- Alert channels (push, SMS, voice fallback), sound choice, test alert, quiet hours; searchable help articles; chat with dispatch linked to a job.

### RSOS-093 Account and security (provider side UI check)

- Make sure the account and security page from batch 2 fits the shell and passes the quality bar.

---

## Part C: admin dashboard (apps/admin)

Benchmark: Linear for speed and keyboard control, Stripe Dashboard for tables and side panels, Onfleet for dispatch, Intercom for timelines.

### RSOS-071 Admin shell

- Collapsible sidebar: Dispatch, Requests, Providers, Recruitment, Markets, Pricing, Finance, Reviews, Analytics, Content, Settings.
- Market switcher (one, several, all); Cmd+K command palette (jump to page, find request by code or phone, provider by name, run actions); keyboard shortcuts with a "?" cheat sheet; saved views on tables; light and dark.

### RSOS-034 + RSOS-072 Live dispatch board

- Split view: live map (requests, online providers, trucks en route) and lanes (new, quoting, picked, en route, on site).
- SLA timers on cards (amber after 2 minutes without a quote, red after 3) with sound for red; actions from cards: call driver or provider (softphone placeholder), push to more providers, assign manually, note, cancel.
- Supply panel: online providers per market and area, gaps highlighted.
- Real requests from the Get Help form appear here live alongside demo ones (demo ones labeled).
  Acceptance: handles 200 live demo requests without lag.

### RSOS-073 Request detail

- Side panel and full page: driver inputs, map, quotes with times, chosen provider, full timeline, calls and recordings (placeholder), texts, notes, attribution, fee and credits, review, disputes; actions logged.

### RSOS-074 Phone intake console (UI)

- Softphone panel (answer, hold, transfer, mute, availability) as UI with a demo incoming call; screen pop with caller history; guided intake form; send location link button.
  Acceptance: phone request created in under 90 seconds (timed).

### RSOS-075 Providers management and document review

- Table with filters and map view; provider detail (company, team, trucks, services and prices, area, documents, performance, wallet, plans, reviews, strikes, notes, activity); review queue with documents side by side, approve or request changes; actions (approve, pause, suspend, credit, message, view as provider).

### RSOS-076 Recruitment pipeline

- Board and table per market: lead, contacted, interested, onboarding, live, lost; real leads from `provider_applications` plus demo; CSV import UI; tasks and reminders; coverage target progress per market.

### RSOS-077 Markets management

- Market list and detail: boundary drawn on a map, time zone, coverage hours, status, phone numbers per source, rules (quote window, radius steps), launch checklist, coverage heatmap. Real markets from the database.

### RSOS-078 Pricing and fees

- Per market and service: price range, provider price limits, our fee, Pro discount, featured slot price; scheduled changes with effective date, approval step, history. Real data from `market_services`.

### RSOS-079 Finance (UI)

- Ledger explorer, top-ups, fees, credits, subscriptions, Stripe reconciliation view, disputes queue, revenue by market, service and source, exports. Demo data.

### RSOS-080 Reviews and quality

- Moderation queue, low-rating follow-ups, provider quality scores with thresholds.

### RSOS-081 Analytics

- Funnel per market and source (visits, started, submitted, quoted, picked, completed); speed (time to first quote, ETA accuracy); supply heatmap by hour; economics (ad spend, cost per request, fee revenue, contribution per market, matching the unit economics model). Charts with date ranges and comparisons. Demo data, plus real counts where tables exist.

### RSOS-082, 083, 084, 094 Content, users, settings, integrations

- Content manager: city intros, FAQs, service copy, banners with preview and publish (real for market intro copy).
- Admin users and roles, audit log, view-as sessions.
- Settings: message template editor (SMS, email, push, English and Spanish), business rules per market, feature flags.
- Integrations: Google Ads, Meta, Microsoft Ads, Twilio, Stripe, Google Maps, Resend cards with status, last sync and connect buttons (placeholders until accounts exist).

---

## Part D: walkthrough for the owner

### RSOS-098 Staging walkthrough page and guide

- `docs/WALKTHROUGH.md` plus a page in admin (demo mode only) listing every screen of all three apps with direct links, grouped by app, in the order a real job happens:
  1. Driver: home, city page, Get Help flow, finding providers, quotes, tracking, completed.
  2. Provider: sign-in as demo, onboarding, go online, incoming offer, active job, wallet, prices, profile, insights.
  3. Admin: sign-in as demo, dispatch board, request detail, phone intake, providers, recruitment, markets, pricing, finance, analytics, settings.
- A "Run full demo" button in admin Demo controls that plays one complete job across all three apps at once (open three browser tabs side by side to watch it).

Acceptance: following the walkthrough, the owner can see a full job from request to review across all three apps on staging.

---

## End of run: final message to the owner

1. Tickets finished with pull request links and pass or fail per acceptance criterion.
2. For each screen: real or demo data.
3. The walkthrough link and how to sign in as demo on staging.
4. BLOCKERS with exact steps, grouped: accounts, keys, decisions, legal.
5. Suggested next batch (wiring real backend: matching, realtime, notifications, payments).
