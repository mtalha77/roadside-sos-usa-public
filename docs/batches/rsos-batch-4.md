# RSOS Batch 4: test campaign ready (real phones, texts, maps, dispatch, first production release)

Project: Roadside SOS USA (working name). Test domain: fixallcontractors.com.
Repository: github.com/mtalha77/roadside-sos-usa
Project folder on this Mac: /Users/mtalha/Claude/roadside-sos-usa

Goal of this batch: by the end, the owner can run the 14-day paid test campaign in San Antonio, Las Vegas and Houston. A real driver can call a tracked number or submit the Get Help form, a dispatcher sees the request live in the admin inbox, texts the driver a location link, calls providers from the browser, manually dispatches the job, and every call, text, form and ad click is attributed to its market and source. Production runs this for real with demo mode off.

Prerequisite: batches 1 to 3 merged into `staging`. If a batch 3 ticket is BLOCKED, work around it and note it.

Read this whole file before starting.

---

## Operating rules

1. Copy this file into the repo as `docs/batches/rsos-batch-4.md` in your first pull request.
2. Same rules as batches 2 and 3: one branch and pull request per ticket into `staging`, zero errors and warnings, CI green, squash-merge yourself, no questions, blockers recorded, cloud only, no hardcoded brand, domain, phone number or city, secrets never printed, logged, committed or pasted into chat, `caffeinate -dims &` during the run.
3. `main` is touched only in RSOS-036, and only if every Release QA check passes. Otherwise stop before merging to `main` and report.
4. Run report: `docs/reports/batch-4.md`, updated after every ticket. For each feature, list: real or demo, which keys it uses, how it was tested, what the owner must do.
5. If context resets: re-read this file, CLAUDE.md and the run report, then continue from the first unfinished ticket.
6. If a ticket fails CI three times for the same unfixable reason, or a needed key is missing, mark it BLOCKED, build everything that does not need the key (behind a feature flag, with tests using mocks), and continue.
7. Keep going until every ticket is done or blocked. No time limit.

## Third-party rules (important)

- All third-party calls go through one adapter per vendor in `packages/core/src/adapters/` (twilio, maps, email, analytics). Each adapter has a real implementation and a fake used in tests, local dev and demo mode. Screens and server code never import a vendor SDK directly.
- Every incoming webhook (Twilio voice, Twilio messaging, Twilio status callbacks) validates the vendor signature and rejects anything unsigned with 403. Test this.
- Every webhook handler is idempotent (store the vendor's event or message SID with a unique constraint) and returns within 2 seconds; heavy work goes to a queue (pgmq).
- Rate limit public endpoints that send texts or codes (per phone, per IP, per market). If Upstash is still missing, use a Postgres-backed limiter and note it.
- Phone numbers are stored in E.164 only, validated with libphonenumber. US numbers only.
- Never send a real SMS or place a real call from automated tests. Real sends happen only in the owner's manual QA steps, and only to `OWNER_TEST_PHONE` on staging.
- Staging and production use separate Twilio Messaging Services, separate TwiML Apps and separate phone numbers, so test traffic never reaches real drivers.

---

## Step 0: key check (do this first, never print values)

For each key below, check presence only (exists or missing) in Vercel for the three projects and for Preview (staging branch) and Production. Write the result as a table in the run report. Never print, echo or log any value.

| Key                                                                                                                           | Used by                                            | Where                                                |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| TWILIO_ACCOUNT_SID                                                                                                            | all Twilio                                         | web, admin, provider                                 |
| TWILIO_AUTH_TOKEN                                                                                                             | webhook signature checks                           | web, admin, provider (sensitive)                     |
| TWILIO_API_KEY_SID                                                                                                            | REST calls, softphone tokens                       | web, admin, provider                                 |
| TWILIO_API_KEY_SECRET                                                                                                         | REST calls, softphone tokens                       | web, admin, provider (sensitive)                     |
| TWILIO_VERIFY_SERVICE_SID                                                                                                     | SMS sign-in codes, phone checks                    | web, admin, provider                                 |
| TWILIO_MESSAGING_SERVICE_SID                                                                                                  | outgoing texts (separate value per environment)    | web, admin, provider                                 |
| TWILIO_TWIML_APP_SID                                                                                                          | browser softphone (separate value per environment) | admin                                                |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY                                                                                               | browser maps (restricted to our domains)           | web, admin, provider                                 |
| GOOGLE_MAPS_SERVER_KEY                                                                                                        | geocoding, distance, places (server only)          | web, admin, provider (sensitive)                     |
| RESEND_API_KEY                                                                                                                | email                                              | web, admin, provider (sensitive)                     |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY                                                                         | bot protection on public forms                     | web                                                  |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN                                                                             | rate limits                                        | web, admin, provider                                 |
| NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA4_ID, GOOGLE_ADS_CONVERSION_ID and labels, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_MS_UET_ID | ad tracking                                        | web                                                  |
| OWNER_TEST_PHONE                                                                                                              | manual QA destination for test texts and calls     | staging only                                         |
| SUPABASE_SERVICE_ROLE_KEY                                                                                                     | server-only admin actions                          | must match the Supabase project for that environment |

Also verify in Twilio (using the API key, read-only): which phone numbers exist, their friendly names, and whether each is attached to the right Messaging Service. Record numbers in the report as last 4 digits only.

If Twilio keys are missing: build all Twilio tickets against the fake adapter, mark the real-wiring acceptance criteria BLOCKED, and continue.

---

## Tickets

### RSOS-099: Staging fixes before new work

- Fix demo sign-in on staging: the staging `SUPABASE_SERVICE_ROLE_KEY` must belong to `rsos-staging`. Add a startup check that decodes the key's project ref (no value printed) and fails loudly in logs and the health endpoint if it does not match `NEXT_PUBLIC_SUPABASE_URL`. Add the same check for dev and production.
- All demo links, share links and emails on staging must use the staging domain from config, never the production domain. Add a test.
- Add `/api/health` in all three apps returning environment name, commit SHA, database reachable, and each adapter as `real`, `fake` or `missing` (never values). Admin shows this on a System status page.
- Smoke test (Playwright, against the staging URL after deploy): "Sign in as demo" works for every role in provider and admin; Get Help flow reaches the quotes screen in demo mode.

Acceptance: demo sign-in works on staging for all roles; health endpoint green on staging; smoke test passes in CI after each staging deploy.

### RSOS-021b: Real maps and SMS codes

- Replace placeholder maps with Google Maps (Maps JavaScript API with our own restrained style from RSOS-011 tokens, light and dark). Use Advanced Markers with our custom icons.
- Address search: Places Autocomplete (New) restricted to the US, biased to the selected market. Reverse geocode the driver's GPS to a readable address and nearest highway/exit where possible.
- Distance and ETA estimates from server using Routes API, cached per request.
- Keys: browser key restricted by HTTP referrer to our domains (production, staging, Vercel preview pattern) and limited to Maps JavaScript and Places; server key restricted to Geocoding, Routes and Places. Document the restrictions in `docs/runbooks/google-maps.md` so the owner can confirm them in Google Cloud.
- Driver phone verification and provider/admin SMS sign-in codes use Twilio Verify (not our own code generation). Rate limit: 3 codes per phone per 10 minutes, 10 per IP per hour. Show friendly errors.
- Budget guard: count Maps and Verify calls per day in our database; admin System status shows today's usage; alert the owner by email above a configurable daily threshold.

Acceptance: on staging, the Get Help flow shows a real map, autocomplete works, and a Verify code reaches `OWNER_TEST_PHONE` (owner manual step). Tests use fakes.

### RSOS-030: Call tracking and the phone flow (IVR)

- Data: `tracking_numbers` table (E.164, market_id, source such as google_ads, website, gmb, meta, bing, provider_line, staging_test; active flag). Managed in Admin > Settings > Phone numbers (add, assign market and source, deactivate). Numbers come from the Twilio account; admin can sync the list from Twilio.
- Incoming call webhook: look up the dialed number, create a `calls` row (caller, market, source, time) and a `requests` row in status `phone_intake` linked to that call.
- Call flow (short, calm, under 20 seconds to a human): greeting with the brand name from config, "If you are in danger, hang up and call 911", optional recording consent line (text from config; recording only where enabled per market), then ring the on-duty dispatchers' browser softphones (RSOS-074b) at the same time, then fall back to the on-duty dispatcher mobile numbers, then voicemail with transcription. Missed and voicemail calls create an urgent inbox item and send a text to the on-duty dispatcher.
- Auto text to the caller after the call connects or goes to voicemail: "Thanks for calling. Share your exact location here: <location link>" (RSOS-023), only if the caller is a mobile number and has not opted out.
- Status callbacks store duration, outcome, and recording URL (recordings stored in Twilio, accessed only through an authenticated admin proxy, never public).
- On-duty schedule: simple weekly schedule per dispatcher in admin, plus an "I am on duty now" toggle.
- Dynamic number insertion on the website: the number shown matches the visitor's market and source (gclid or utm_source → google_ads number; otherwise website number). Stored in a first-party cookie for 90 days. Click-to-call fires the call conversion event (RSOS-031).

Acceptance: staging test number rings the admin browser softphone, creates call and request rows with the correct market and source, sends the location-link text to `OWNER_TEST_PHONE`, and voicemail creates an urgent inbox item. Signature check and idempotency tested.

### RSOS-074b: Real browser softphone for dispatchers

- Twilio Voice JavaScript SDK in the admin app. Access tokens minted server-side with the API key, 1 hour TTL, identity = dispatcher user id, only for users with the dispatcher or super admin role.
- Softphone dock (from batch 3 design): incoming call screen with caller number, market, source and any linked request; answer, decline, mute, hold, transfer to another dispatcher, hang up; outbound calling to drivers and providers from any request or provider page with our tracking number as caller ID for that market.
- Every outbound call is logged on the request timeline.
- Microphone permission flow with a clear explanation; works in Chrome, Safari and Edge on desktop; graceful message on unsupported browsers.
- Presence: dispatcher shows Available, Busy (on a call), Away. Only Available dispatchers get rung.

Acceptance: owner can answer an incoming staging call in the browser, call `OWNER_TEST_PHONE` out from a request page, and both calls appear on the request timeline.

### RSOS-034b: Real inbox and manual dispatch

The test campaign runs with manual dispatch (marketplace automation comes in batch 5).

- Admin Inbox becomes real: new requests from the web form, calls, voicemails and incoming texts in one live list (Supabase Realtime), grouped by market, sorted by urgency and wait time. Unread and unassigned counts. Sound and browser notification for new items (toggle).
- Claim: a dispatcher claims a request; others see who owns it. Auto-unclaim after 10 minutes of no action, with alert.
- Request detail side panel: driver info, location on map, service, vehicle, notes, full timeline (calls, texts, status changes, notes).
- Manual dispatch: list nearby active providers for that service sorted by distance (from provider base location and service radius), showing their prices for that service, last response time and acceptance rate. Dispatcher calls the provider from the softphone, records the quoted price and ETA, and assigns the job. Driver gets a text with provider name, price, ETA and a tracking link.
- Status steps: new → contacted → location confirmed → provider assigned → on the way → arrived → completed, or cancelled / no provider found (reason required). Each step timestamped.
- Fee ledger entry created when a job is assigned (the per-job fee from the price table), marked `manual_test` so the test campaign economics can be reviewed without charging providers yet.
- Two-way texting from the request panel through the market's tracking number; incoming replies thread into the same request.
- Saved replies (admin-editable templates with placeholders: driver first name, provider name, price, ETA, link).

Acceptance: a staging request flows from web form to completed with all steps, texts and a fee ledger row, viewed by two dispatchers at once with live updates.

### RSOS-023: Location link

- Short, unguessable link `/l/<token>` (token 22+ chars, expires in 2 hours, single request).
- Mobile page: one big button "Share my location", asks for GPS, shows the pin on the map for confirmation and lets the driver drag it, optional landmark note and photo of the vehicle (stored in Supabase Storage, private bucket).
- Fallback: address search when GPS is denied.
- On submit: request location updated, timeline entry, dispatcher notified live.
- Works on slow 3G: page under 100 KB of JavaScript before the map loads; map loads after the button.

Acceptance: from a text on `OWNER_TEST_PHONE`, owner opens the link, shares location, and sees it appear in the admin request panel within 2 seconds.

### RSOS-035: Real texts and emails, opt-outs and A2P 10DLC

- All transactional texts go through the Messaging Service for that environment. Templates live in the database (editable in admin), with placeholders, character counter and segment estimate.
- Compliance: STOP, UNSUBSCRIBE, CANCEL, END, QUIT opt out; START and UNSTOP opt back in; HELP returns brand name and support contact from config. Store opt-out state per phone and block sends to opted-out numbers in our code too (do not rely only on Twilio). First text to a new number includes "Reply STOP to opt out".
- Quiet hours: no non-urgent texts between 9pm and 8am in the recipient's market time zone. Urgent job texts are allowed.
- Delivery status callbacks stored per message; admin shows delivered, failed (with Twilio error code meaning), and undelivered counts per day.
- Emails through Resend from a verified sending domain (configured in config). Templates in `packages/emails` (React Email): provider application received/approved, request receipt for driver (if email given), daily dispatch summary for the owner. Use the Resend fake when the key is missing.
- Write `docs/runbooks/a2p-10dlc.md`: what the owner must register (brand, campaign use case "Customer care / Mixed", sample messages taken from our actual templates, opt-in description matching our Get Help form consent text and call flow, privacy and terms URLs). Add the consent checkbox text to the Get Help form if not already present and make sure the privacy policy mentions SMS.
- Until A2P 10DLC is approved, the admin shows a banner "Texting limited: carrier registration pending" and texts to non-test numbers are queued, not sent, unless the owner turns on an override.

Acceptance: STOP/START/HELP tested with fakes and once manually on staging; opt-out blocks sends; delivery statuses visible in admin; runbook complete.

### RSOS-031: Ad tracking and attribution

- Capture on first visit and store in a first-party cookie and on the request: gclid, gbraid, wbraid, fbclid, msclkid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing page, referrer, market.
- Google Tag Manager on the public website only (not provider or admin), loaded after consent where required. Consent banner with Google Consent Mode v2 defaults (denied until accepted for ad storage; analytics configurable).
- Conversion events sent from the server where possible: `request_submitted` (form), `call_started` and `call_qualified` (call longer than 60 seconds, from Twilio callback), `job_assigned` and `job_completed`. Each with market, service and source, deduplicated by event id.
- Google Ads: offline conversion upload file (CSV in the Google Ads format, gclid based) generated daily in admin for manual upload, because the Ads API developer token is pending. Meta: Conversions API ready behind a flag. Microsoft: UET events.
- Admin > Marketing view: per market and source for a chosen date range: visits, calls, qualified calls, forms, requests, assigned jobs, completed jobs, and cost per each when the owner enters daily ad spend per market and channel (manual entry form; API import comes later).

Acceptance: a test visit with a fake gclid on staging produces a request with that gclid; the call number swaps to the google_ads number; the conversion CSV contains the row; GTM loads only after consent.

### RSOS-089-prep: Test campaign kit

- Market launch checklist in admin per market: tracking numbers assigned, at least N active providers per core service (configurable, default 3), prices set, on-duty schedule covered 24/7 or the configured hours, landing pages live, conversion tracking verified. Market cannot be switched to "live" until every item is green (super admin can override with a reason, logged).
- Landing pages per test market and core service (towing, jump start, lockout, flat tire, fuel delivery, winch-out) using the existing page templates, content from the database, one H1, real local details from config (no fake reviews, no invented statistics), fast (LCP under 2.0s on mobile in Lighthouse on staging).
- `docs/runbooks/dispatch-playbook.md`: what a dispatcher does for each request type, call scripts (short), what to say when no provider is found, safety script for dangerous locations (tell the driver to call 911), how to handle price disputes, how to record outcomes.
- Test campaign analytics view in admin: per market for the 14 days: requests, calls, answer rate, time to first contact, time to provider assigned, fill rate (assigned / requests), completion rate, average quoted price, fees that would have been earned, cost per request and cost per completed job (from entered ad spend). Export to CSV. This view is what decides the launch city.

Acceptance: checklist blocks going live on a market with missing items; analytics view shows correct numbers on seeded test data (unit tested).

### RSOS-036: Release QA and first production release

Run only when all tickets above are done or BLOCKED with a working fallback.

Release QA (all must pass, write results in `docs/reports/release-1.md`):

1. CI green on `staging`: build, lint, typecheck, unit, e2e, accessibility (axe, no violations), Lighthouse budgets (website mobile performance 90+, accessibility 100, best practices 100, SEO 100).
2. Staging smoke tests pass (RSOS-099), plus the full Get Help → dispatch → completed flow in demo mode and in real mode.
3. Security: RLS enabled on every table with tests per role; Supabase advisors show no security errors on `rsos-staging` and `rsos-prod`; no secret in the client bundle (scan the build output for known key prefixes); every webhook rejects unsigned requests; rate limits active.
4. DEMO_MODE is off and impossible in production: test that production build ignores the flag, the demo badge and "Sign in as demo" do not render, demo scenario routes return 404.
5. Production database: all migrations applied to `rsos-prod`, seed only real reference data (markets, services, price table), no demo rows (query check), backups (PITR if available) confirmed, owner super admin account exists.
6. Production keys present (Step 0 table, Production column), Twilio production Messaging Service and TwiML App webhooks point to the production domain, Google Maps keys restricted.
7. Monitoring: Sentry receiving errors from all three production apps (send one test event), uptime check on `/api/health` for all three domains, alert email to owner.
8. Rollback plan written: previous deployment id per project and the exact steps to roll back in Vercel.

If any check fails and cannot be fixed, do not merge to `main`. Report what failed.

If all pass: open a release pull request `staging` → `main` titled "Release 1: test campaign ready", with the QA report linked, then merge it. Verify after deploy: fixallcontractors.com, www, pro. and admin. all serve the new build (check commit SHA in `/api/health`), demo mode off, no errors in Vercel runtime logs for 15 minutes. Tag the release `v0.1.0`.

---

## Owner manual QA (list these in the end-of-run summary, with exact steps)

1. Call the staging test number from your phone; answer it in the admin softphone.
2. Receive the location-link text; share your location; watch it appear in admin.
3. Reply STOP, then START, then HELP to the staging number; confirm responses.
4. Sign in to the provider portal with an SMS code.
5. Run one full manual dispatch on staging to yourself as the "provider".
6. On production after release: call the production number for one market and confirm it rings you; submit one real Get Help request and cancel it as "test".

## End-of-run summary (post in the run report and as your final message)

- Each ticket: done, partial or BLOCKED, with pull request links.
- Step 0 key table (present or missing, no values).
- What is real versus fake for every adapter, per environment.
- Owner action list, in order, with the exact screen or link for each (A2P 10DLC status, Google Ads developer token, Turnstile, Upstash, Vercel Analytics, attorney review of terms and privacy, repo privacy).
- Release 1 status: released (with tag and commit) or not released (with failing checks).
- Suggested next batch: batch 5, marketplace engine (automatic quote broadcast to providers, 3-minute quote window, provider offer screen live, driver picks a quote).
