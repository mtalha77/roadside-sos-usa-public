# RSOS Batch 2: long autonomous run for Claude Code

Project: Roadside SOS USA (working name). Test domain: fixallcontractors.com.
Repository: github.com/mtalha77/roadside-sos-usa
Project folder on this Mac: /Users/mtalha/Claude/roadside-sos-usa

Already done: RSOS-002, 003, 004, 005, 007, 009. DNS for all hostnames has been updated by the owner.
Earlier batch file: docs/batches/rsos-batch-1.md (contains the full specs for RSOS-010, 096, 097 and 011).

This run is long (many hours). Read this whole file before starting.

---

## Operating rules for this run

1. Copy this file into the repo as `docs/batches/rsos-batch-2.md` in your first pull request.
2. Work only in /Users/mtalha/Claude/roadside-sos-usa. Read CLAUDE.md first and follow it.
3. Do the tickets in the order listed. For each ticket:
   - branch `rsos-<id>-<short-slug>` from `staging`,
   - build, write tests, and make lint, typecheck, tests and build pass with zero errors and zero warnings,
   - pull request into `staging` titled `RSOS-<id>: <title>`,
   - wait for CI and fix until green,
   - squash-merge into `staging` yourself,
   - check the result on the staging hosts where relevant.
     Never push or merge to `main`.
4. Never stop to ask questions. If something needs the owner (payment, login, secret, decision), do every other part, record it under BLOCKERS in the run report with exact steps, and move on.
5. Accounts not set up yet, by design (do not block on them):
   - **Cloudflare Turnstile:** use Cloudflare's official Turnstile test keys on Development and Preview, and in code paths for staging until real keys exist. Production keys come later.
   - **Upstash Redis:** keep the in-memory fallback for rate limits.
   - **Twilio (SMS codes), Resend (email), Google Maps, Sentry, PostHog, Stripe:** build against clean interfaces with a mock or test-mode provider, read keys from environment variables, fail safely when keys are missing, and list each needed account and variable name under BLOCKERS once.
6. Secrets: never print, log, commit or ask for secret values. Generate with openssl and pipe straight into `gh secret set` or `vercel env add`.
7. Cloud only: no Docker, no local Supabase. Database work goes through migrations applied by CI to `rsos-dev`, then staging on merge.
8. Multi-market and rename-ready always: every market-specific thing comes from the database; no hardcoded brand, domain, phone or city outside `packages/config` and environment variables.
9. Keep the Mac awake: start `caffeinate -dims &` at the beginning, stop it at the end.
10. Run report: `docs/reports/batch-2.md`, updated and committed after every ticket (status, pull request link, pass or fail per acceptance criterion, blockers, notes for the next developer).
11. Long-run memory: if your context is reset or summarized, re-read this file, CLAUDE.md and `docs/reports/batch-2.md`, then continue from the first ticket not marked done.
12. If one ticket fails CI three times for the same reason you cannot fix, mark it BLOCKED with details and continue with the next ticket that does not depend on it.
13. Keep going until every ticket below is done or blocked. No time limit.

## Quality bar for everything in this run

- **Design:** "calm under stress". Deep ink neutrals, one safety-amber signal color used only for the main action and urgency, large type on mobile (body 17px), generous spacing, short purposeful motion (150 to 250 ms), full dark mode. No stock photos, no template gradients, no generic hero illustrations, no AI-looking art.
- **References for patterns and polish (do not copy):** Uber (map-first request flow), Curbside SOS (quotes list, city pages with provider count and ETA), Airbnb (trust cards), Stripe.com and Linear.app (marketing typography and layout), Linear and Stripe Dashboard (admin speed, tables, side panels).
- **Content honesty:** no fake numbers, reviews, testimonials or provider counts. Show live data only when it exists; otherwise hide the block.
- **Every page and component:** works at 375px and 1440px, light and dark, keyboard usable, 48px touch targets, zero axe serious or critical issues, zero console errors.

---

## Part A: finish quality foundations

### RSOS-010 Testing setup

Use the full spec in docs/batches/rsos-batch-1.md.

### RSOS-096 QA pipeline and release gates

Use the full spec in docs/batches/rsos-batch-1.md.

### RSOS-097 Team-ready repository and onboarding

Use the full spec in docs/batches/rsos-batch-1.md.

### RSOS-011 Design tokens, typography and motion

Use the full spec in docs/batches/rsos-batch-1.md.

---

## Part B: design system

### RSOS-012 Core component library

Goal: polished, accessible building blocks used by all three apps.

Build (in `packages/ui`, based on shadcn/ui and Radix, restyled to our tokens):

- Actions and inputs: Button (sizes, loading, icon), IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio cards, Switch, Slider, PhoneInput (US format), OTPInput (6 digits, paste and SMS autofill), CurrencyInput, DatePicker, FileUpload (drag and drop, camera on mobile).
- Layout and feedback: Card, Sheet (bottom sheet on mobile), Dialog, Drawer (side panel), Tabs, Accordion, Tooltip, Popover, DropdownMenu, Toast, Alert, Badge, Avatar, Skeleton, EmptyState, Stepper, Progress, Divider.
- Data: DataTable on TanStack Table (sorting, filters, column visibility, pagination, row selection, sticky header, saved views hook, virtualization), Stat card, KeyValue list, Timeline.
- Command palette (Cmd+K) component for admin.
- Every component: Storybook story with all states, keyboard support, dark mode, unit test for behavior.

Acceptance criteria:

1. All listed components exist with stories and pass axe checks.
2. Sheets and dialogs trap focus and close with Escape and swipe down on mobile.
3. DataTable scrolls 10,000 rows smoothly.

### RSOS-013 Product components

Goal: the signature pieces that make the product feel specific.

Build:

- ServiceTile (icon, label, hint, large tap area) for 6 services: flat tire, won't start, locked out, out of gas, basic tow, winch out.
- StatusPill for every request state; ETAChip; PriceTag (tabular numbers).
- CountdownRing (smooth, accurate in background tabs, accessible text alternative).
- QuoteCard (photo, name, rating and count, insured and licensed badges, ETA, all-in price, "Fastest" or "Best price" tag).
- ProviderCard and ProviderBadgeRow.
- MapView wrapper for Google Maps with our light and dark map styles, driver and provider markers, smoothly animated moving marker. Without a Maps key, render a clean static placeholder and record the BLOCKER.
- BigToggle (go online or offline) and SwipeToConfirm.
- LiveDot and "updated x seconds ago" indicator.

Acceptance criteria:

1. Every component has stories for all states including loading and error.
2. CountdownRing keeps correct time with the tab in the background.
3. MapView works with a key and degrades cleanly without one.

### RSOS-014 Icons and illustrations

Build:

- Lucide icons wrapped in one Icon component.
- Original SVG icon set, one stroke style and grid: the 6 services and vehicle types (car, SUV, pickup, motorcycle, van, RV or trailer).
- Simple original line illustrations for empty states and the how-it-works section.

Acceptance criteria:

1. All icons share stroke width and grid and work in both themes.
2. No third-party illustration packs or stock images in the repo.

### RSOS-015 Accessibility and language foundation

Build:

- next-intl in all apps; every user-facing string in message files; English complete, Spanish file scaffolded.
- Number, currency, date and time formatting by locale and market time zone.
- Accessibility checklist in CLAUDE.md (labels, focus order, contrast, live-region announcements, 48px targets).
- Lint rule blocking hardcoded user-facing strings.

Acceptance criteria:

1. No hardcoded user-facing strings (lint enforces it).
2. Spanish scaffold renders without layout breaks.

---

## Part C: data core and sign-in

### RSOS-016 Core database schema v1

Goal: the tables the website, phone line and test campaign need, designed for many markets.

Build (migrations, Row Level Security on every table, tests for every policy):

- `markets`: slug, name, state, time zone, center point, boundary polygon (PostGIS), status (draft, test, active, paused), coverage hours, support phone, SEO title and intro.
- `market_phone_numbers`: market, number, purpose (website, google_ads, meta, microsoft, organic, provider_line), provider ID field for Twilio.
- `services`: slug, name, description, icon key, needs destination (tow, winch out), allowed vehicle types, sort order.
- `market_services`: market, service, enabled, typical price range, platform fee, effective-from date (history kept, never overwritten).
- `requests`: ID, short code (like R-7KQ2), secret status token, market, service, status, channel (web, phone, landing page), driver name and phone (E.164, verified flag), pickup point and address, landmark or mile marker note, destination point and address, vehicle (year, make, model, color, type, EV flag), situation flags (safe spot, on highway, passengers, keys available, spare available), notes, assigned dispatcher, timestamps per status.
- `request_events` (full history), `attributions` (UTM, gclid, gbraid, wbraid, fbclid, msclkid, landing page, referrer, device, hashed IP, call ID), `consents` (phone, type, policy version, time, IP, user agent, source), `provider_applications`, `contact_messages`, `waitlist`, `audit_log`.
- Functions: market for a point; create request with attribution and consent in one transaction; read request by token (safe fields only).

Acceptance criteria:

1. A point inside each seeded market returns that market; outside returns none.
2. Anonymous users cannot read or write any table directly (tests prove it).
3. Changing a fee creates a new dated row; old requests keep their fee.

### RSOS-017 Seed data: markets, services, prices and fees

Build:

- Services: flat tire, won't start, locked out, out of gas, basic tow, winch out.
- Markets with county-based boundaries from US Census cartographic boundary files and correct time zones:
  - San Antonio, TX (test, America/Chicago): Bexar and surrounding metro counties
  - Las Vegas, NV (test, America/Los_Angeles): Clark County
  - Houston, TX (test, America/Chicago): Harris, Fort Bend, Montgomery
  - Phoenix, AZ (inactive, America/Phoenix): Maricopa
  - Orlando, FL (inactive, America/New_York): Orange, Seminole, Osceola
- Typical price ranges (USD) and platform fees per service, for all markets:
  - Won't start (jump start): range 50 to 150, fee 22.50
  - Locked out: range 50 to 170, fee 27.50
  - Flat tire: range 50 to 160, fee 22.50
  - Out of gas: range 50 to 190 plus fuel, fee 22.50
  - Basic tow: range 82 to 130 plus per mile, fee 42.50
  - Winch out: draft, no fee yet, disabled until reviewed
- Production-safe seed (real reference data only) separate from a dev-only seed with fake providers and requests for `rsos-dev`.

Acceptance criteria:

1. Staging contains the five markets and six services; production gets the same on release.
2. Boundaries render correctly on a map (admin preview page or Storybook story).
3. No fake data in staging or production.

### RSOS-018 Authentication and roles

Build:

- Admin: email and password with required authenticator-app second step (Supabase MFA); roles super_admin, ops_manager, dispatcher, support, finance, marketing, read_only; optional restriction to selected markets.
- Provider: email and password or magic link, plus phone verification; roles owner, manager, operator.
- Driver: no account to request help; phone verified by SMS code (interface ready; Twilio Verify through Supabase phone auth when keys exist; mock in dev and preview).
- Roles in the session token through an auth hook; route protection in admin and provider apps; role checks in database policies.
- Session length: admin 12 hours; provider 30 days on a trusted device.

Acceptance criteria:

1. A dispatcher limited to Houston cannot read San Antonio requests (policy test).
2. Admin sign-in without the second step is impossible.
3. Provider operators cannot read wallet or billing data (policy test, tables may be stubs).

### RSOS-093 Account and security settings

Build:

- Provider second step: 6-digit code by email (custom: valid 10 minutes, 5 attempts then 15-minute lock) or SMS, authenticator app optional; admin authenticator required.
- "Trust this device for 30 days" for providers.
- Account and security page in provider and admin apps: change name, email (confirmed on old and new), password, phone; choose second-step method; recovery codes; signed-in devices with sign out; sign-in history.
- Security emails for new device sign-in, password change, second-step change (through the email interface; Resend later).
- Forgot password and lost second-step flows; admin reset only by super admin.
- Suspended or paused provider screen with reason and next step; provider account closure request.

Acceptance criteria:

1. Email-code providers cannot sign in without the code; 5 wrong codes lock for 15 minutes.
2. Signing out a device ends that session within 1 minute.
3. Every security change is written to the audit log and triggers the email interface.

---

## Part D: the public website (apps/web)

### RSOS-019 Website structure, layout and market detection

Build:

- Routes, all market and service pages generated from the database:
  - `/` home, `/get-help` (placeholder start screen for now), `/r/[token]` (placeholder)
  - `/roadside-assistance/[state]/[city]`, `/services/[service]`, `/roadside-assistance/[state]/[city]/[service]`
  - `/providers/[slug]` (placeholder), `/for-providers`, `/for-providers/apply`
  - `/how-it-works`, `/faq`, `/about`, `/contact`, `/safety`, `/legal/*`
- Header: logo, services menu, cities menu, For providers, tap-to-call with the current market's number, Get help now button.
- Mobile: sticky bottom bar with Call and Get help now.
- Footer: cities, services, company, legal, provider links, phone.
- Market detection: city page market first; otherwise Vercel IP location headers; visitor can change it; choice remembered in a cookie. Outside all markets: "not in your area yet" with a waitlist field saving to `waitlist`.

Acceptance criteria:

1. A Houston visitor sees the Houston number without choosing (test with mocked headers).
2. A visitor outside all markets sees the waitlist message, never a broken flow.
3. Adding a market in the database adds its pages and menu entries with no code change.

### RSOS-020 Home page

Build:

- Hero: headline about fast quotes from local providers; the 6 service tiles as the main call to action (tap opens `/get-help` with that service); Call now secondary; trust row (insured providers, quotes in about 3 minutes, no membership).
- How it works in 3 steps shown with real product UI components (QuoteCard, tracking view), not illustrations.
- Live proof per market only when real data exists (provider count, average ETA); price ranges from `market_services`.
- Cities served, services, reviews section hidden until real reviews exist, FAQ, provider recruitment band.
- Hero renders without waiting for maps or third-party scripts.

Acceptance criteria:

1. Lighthouse mobile LCP under 1.5 seconds on the staging home page.
2. Tapping a service tile opens `/get-help` with that service selected.
3. No fake numbers or reviews anywhere.

### RSOS-024 City pages

Build:

- One page per test or active market: city headline, call button with the market number, service tiles, typical price ranges per service, areas and highways covered, local FAQs, nearby cities. Provider count and average ETA only when real data exists.
- Intro copy stored per market in the database (editable later in admin); unique, specific copy for San Antonio, Las Vegas and Houston, not template filler.
- Structured data: Service, BreadcrumbList, FAQPage. Inactive markets unpublished.
- Pages cached and refreshed when market data changes.

Acceptance criteria:

1. The three test markets have live, indexable pages on staging with unique copy (indexing stays off on staging by rule).
2. Structured data validates.

### RSOS-025 Service pages and city plus service pages

Build:

- One page per service: what it covers, what to expect, typical price range, typical time, safety tips, FAQ.
- One page per service per active or test market with local prices, call button and `/get-help` start with market and service preselected.
- Internal links between city, service and city plus service pages.

Acceptance criteria:

1. 6 service pages and 18 city plus service pages exist for the 3 test markets with unique content.
2. Every page starts the flow with the right market and service selected.

### RSOS-027 How it works, FAQ, About, Contact, Safety

Build:

- How it works (drivers and providers tabs), FAQ (searchable, grouped, FAQPage data), About, Contact (form saving to `contact_messages`, Turnstile test keys), Safety tips.
- All copy in message files.

Acceptance criteria:

1. FAQ structured data validates.
2. Contact submissions are stored and trigger the email interface.

### RSOS-026 For Providers page and application form

Build:

- Page: how jobs arrive (quotes, driver picks), flat fee per picked request read from `market_services`, providers set their own prices, drivers pay providers directly, optional Pro plan (99 to 149 USD per month, 15% off fees) and Featured placement (25 to 50 USD per month per market), requirements (insurance; TDLR license in Texas).
- Application form: company, contact name, phone, email, markets, services, number of trucks, insurance carrier, license number, how they heard about us. Saves to `provider_applications`; triggers notification interface. Turnstile test keys and rate limit.

Acceptance criteria:

1. Applications are stored with all fields and the market tagged.
2. Applicant confirmation goes through the email and SMS interfaces (mock until keys exist).

### RSOS-028 Legal pages, cookie consent and privacy choices

Build:

- Pages: Driver Terms (we are a marketplace, not the service provider), Provider Terms (fees, wallet, credits, conduct, insurance, removal), Privacy Policy (California, Texas, Nevada, Florida), SMS Terms (opt-in wording, STOP and HELP, frequency, carrier rates), Call Recording Notice, Cookie Policy, Accessibility Statement.
- Every page marked "Draft for attorney review" and versioned; consent records store the version shown.
- Cookie banner with Google Consent Mode v2, "Your privacy choices" link, honor Global Privacy Control.
- Record a BLOCKER: "US attorney review required before the test campaign."

Acceptance criteria:

1. Analytics and ad tags cannot fire before consent where consent is required (test).
2. Every consent record links to a policy version.

### RSOS-032 Technical SEO

Build:

- Titles, descriptions, canonical URLs from templates; dynamic sitemap index (markets, services, city plus service); robots rules (staging and previews disallow all; production allows published pages only); Open Graph images generated per city and service; Organization and WebSite structured data; breadcrumbs.
- Redirects table and middleware ready for the future domain change (301s).

Acceptance criteria:

1. No duplicate titles or missing canonicals (automated crawl test).
2. Sitemap lists only published pages and updates when a market is activated.

### RSOS-033 Performance budget

Build:

- Lighthouse CI on home, city, service and `/get-help` pages with budgets: LCP under 2 seconds mobile, CLS under 0.05, INP under 200 ms; landing-type pages total JavaScript under 150 KB.
- Self-hosted fonts, optimized images, third-party scripts after first paint.

Acceptance criteria:

1. A pull request that breaks a budget fails CI (prove with a throwaway pull request, then close it).
2. All listed pages pass on staging.

---

## End of run: final message to the owner

When everything is done or blocked, give a short plain-language summary:

1. Tickets finished, with pull request links and pass or fail per acceptance criterion.
2. BLOCKERS, each with exact steps for the owner, grouped: accounts to create, keys to add, decisions, legal.
3. Links to check on staging (home, each city page, a city plus service page, For Providers, legal pages, admin and provider sign-in).
4. Whether the release from `staging` to `main` is ready, based on the QA gates.
5. Suggested next tickets.
