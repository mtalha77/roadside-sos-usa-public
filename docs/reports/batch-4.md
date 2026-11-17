# RSOS Batch 4: run report

- Run started: 2026-11-16. No time limit.
- Spec: `docs/batches/rsos-batch-4.md`. Same operating rules as batches 2 and 3.
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the
  first ticket not marked Done.

## Summary

| Ticket                                              | Status                   | Pull request                                                         |
| --------------------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| Step 0 Key check                                    | Done                     | (this file)                                                          |
| RSOS-099 Staging fixes before new work              | Done                     | [#172](https://github.com/mtalha77/roadside-sos-usa-public/pull/172) |
| RSOS-021b Real maps and SMS codes                   | Done (real keys BLOCKED) | [#175](https://github.com/mtalha77/roadside-sos-usa-public/pull/175) |
| RSOS-030 Call tracking and the phone flow (IVR)     | Done (real keys BLOCKED) | [#173](https://github.com/mtalha77/roadside-sos-usa-public/pull/173) |
| RSOS-021c Owner scope change: email codes, no Maps  | Done                     | [#176](https://github.com/mtalha77/roadside-sos-usa-public/pull/176) |
| RSOS-074b Real browser softphone                    | Done (real keys BLOCKED) | [#177](https://github.com/mtalha77/roadside-sos-usa-public/pull/177) |
| RSOS-034b Real inbox and manual dispatch            | Done                     | [#179](https://github.com/mtalha77/roadside-sos-usa-public/pull/179) |
| RSOS-023 Location link                              | Done                     | [#180](https://github.com/mtalha77/roadside-sos-usa-public/pull/180) |
| RSOS-035 Real texts and emails, opt-outs, A2P 10DLC | Done (texting off)       | [#181](https://github.com/mtalha77/roadside-sos-usa-public/pull/181) |
| RSOS-031 Ad tracking and attribution                | Done (ad keys missing)   | [#182](https://github.com/mtalha77/roadside-sos-usa-public/pull/182) |
| RSOS-089-prep Test campaign kit                     | Done                     | (this PR)                                                            |
| RSOS-036 Release QA and first production release    | Not released (see below) | `docs/reports/release-1.md`                                          |

## Run blocker (resolved): a new security advisory stopped every merge (2026-11-17)

`pnpm audit --prod --audit-level high` (inside the required `lint` check) started failing on
GHSA-fc5q-39xc-vjpf: picomatch ReDoS (high), every version up to 4.0.7, **no patched version**.
It comes in through build and dev tooling (eslint-config-next, vite, `@parcel/watcher` under
next-intl); no user input reaches it.

- [#177](https://github.com/mtalha77/roadside-sos-usa-public/pull/177) (RSOS-074b) passes every
  other check (build, db, e2e, lighthouse, scan, storybook, test, typecheck); only `lint` fails,
  on this audit step.
- Accepting the advisory is an owner decision, so the run stopped and asked. **The owner accepted
  it** (2026-11-17): `pnpm-workspace.yaml` lists it under `auditConfig.ignoreGhsas` with the
  reason, to be removed when picomatch ships a fix. The run then continued.
- Found during Release QA: since RSOS-099, every staging database deploy after the staging smoke
  has failed its "no fake data" check (the smoke's own Get Help request uses a fictional
  number), and that skipped the Auth configuration step, so staging's sign-in email did not
  carry the 6-digit code. The fix (the check skips the smoke's request; Auth is configured
  before the check) merged with #179; staging deploys are green again.
- After the owner accepted it, the remaining tickets merged one pull request at a time: #177,
  #179, #180, #181, #182 and RSOS-089-prep.

## Step 0: key check (presence only, no values)

Checked 2026-11-16 with `vercel env ls` (names and targets only). "Preview" means every preview
branch, which includes `staging`; "staging" means a value scoped to the `staging` branch only.
Twilio could not be inspected because no Twilio keys exist anywhere.

| Key                                                                                                                         | rsos-web: Preview / staging / Production  | rsos-provider: Preview / staging / Production | rsos-admin: Preview / staging / Production |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| TWILIO_ACCOUNT_SID                                                                                                          | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| TWILIO_AUTH_TOKEN                                                                                                           | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| TWILIO_API_KEY_SID                                                                                                          | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| TWILIO_API_KEY_SECRET                                                                                                       | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| TWILIO_VERIFY_SERVICE_SID                                                                                                   | deferred by owner (missing)               | deferred by owner (missing)                   | deferred by owner (missing)                |
| TWILIO_MESSAGING_SERVICE_SID                                                                                                | deferred by owner (missing)               | deferred by owner (missing)                   | deferred by owner (missing)                |
| TWILIO_TWIML_APP_SID                                                                                                        | n/a                                       | n/a                                           | missing / missing / missing                |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY                                                                                             | deferred by owner (missing)               | deferred by owner (missing)                   | deferred by owner (missing)                |
| GOOGLE_MAPS_SERVER_KEY                                                                                                      | deferred by owner (missing)               | deferred by owner (missing)                   | deferred by owner (missing)                |
| RESEND_API_KEY                                                                                                              | deferred by owner (missing)               | deferred by owner (missing)                   | deferred by owner (missing)                |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY                                                                       | present / present (via Preview) / present | n/a                                           | n/a                                        |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN                                                                           | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA4_ID, GOOGLE_ADS_CONVERSION_ID + labels, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_MS_UET_ID | missing / missing / missing               | n/a                                           | n/a                                        |
| OWNER_TEST_PHONE                                                                                                            | missing (staging)                         | missing (staging)                             | missing (staging)                          |
| SUPABASE_SERVICE_ROLE_KEY                                                                                                   | not used (by design)                      | present / present / **missing**               | present / present / present                |

**Owner scope change (batch file, "Scope changes from the owner"):** Verify, Messaging, Google
Maps and Resend keys are expected to be missing and are reported as **deferred by owner**, not as
blockers. Sign-in uses Supabase email codes, maps use the dummy adapter, product emails use the
Resend fake. Twilio voice keys (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`,
`TWILIO_API_KEY_SECRET`) are still needed and still missing: voice real wiring is BLOCKED.

Twilio phone numbers and Messaging Service attachments: **not checked (BLOCKED)**, no Twilio
credentials. Consequence, per the batch rules: every Twilio, Maps, email, rate-limit and
ad-tracking feature is built against its fake adapter, and the real-wiring acceptance criteria are
BLOCKED until the owner adds the keys. `rsos-provider` Production has no `SUPABASE_SERVICE_ROLE_KEY`
(needed before release: RSOS-036 check 6).

## Tickets

### RSOS-021c: Owner scope change (email codes, no SMS, no Google Maps)

Applies the "Scope changes from the owner" section of the updated batch file (copied into
`docs/batches/rsos-batch-4.md`), which overrides the tickets below it.

- **Email codes for everyone.** Providers and admins: an "Email code" sign-in
  (`@rsos/account` `EmailCodeSignIn`, Supabase Auth email OTP, existing accounts only, the same
  answer whether or not an account exists, 3 codes per address per 10 minutes and 10 per IP per
  hour). Drivers: Get Help asks for an optional email; with one, a 6-digit code is emailed
  (Supabase OTP) and checked on the last step, and the request stores `driver_email` and
  `driver_email_verified`. Without one, the request goes through and is confirmed on the call.
  Demo hosts (never production) show the code on screen and email nothing; demo driver accounts
  sign in by email too. `scripts/supabase-auth-config.sh` sets 6-digit codes, a 10-minute expiry
  and code-carrying sign-in emails (no brand in the text).
- **Removed:** Twilio Verify (adapter, usage counter, SMS sign-in, the phone lookup function
  `auth_user_for_phone`, the texting consent on Get Help).
- **Maps dummy everywhere.** The Google adapter is on only with both keys **and**
  `MAPS_ENABLED=true`; otherwise the dummy: typed address with format validation
  (`isPlausibleAddress`), no autocomplete (`/api/places` answers 404), no geocoding, GPS from the
  browser stored as coordinates, haversine distance and ETA from `MAPS_AVG_SPEED_MPH` (default
  30). The placeholder map gained simple vector streets, pin markers and a truck that drives the
  route (still with reduced motion). No interactive map on marketing or city pages.
- **Adapter states** gain `deferred` (maps, texting, email): never "missing" in production.
  System status and `/api/health` show it; Twilio is split into voice (`twilio`) and texts
  (`texting`, which also needs `TEXTING_ENABLED`).
- Real or demo: real Supabase email codes in production; dummy maps everywhere. Keys: none new.
  Tested: unit tests (maps flag, ETA, address format, adapter states), pgTAP (email stored on
  submit), e2e `maps-and-email-codes.spec.ts`, updated Get Help, staging smoke and driver account
  specs. Owner: Supabase's built-in email sender allows only a few emails per hour; connect custom
  SMTP (Resend) before real traffic.

### RSOS-099: Staging fixes before new work

- **Service key project check.** `@rsos/db/key-check` decodes only the `ref` and `role` claims of a
  legacy JWT service key and compares them with the project ref in `NEXT_PUBLIC_SUPABASE_URL`
  (match, mismatch, unverifiable for `sb_secret_` keys, missing). Every app's
  `instrumentation.ts` logs a loud error at startup on a mismatch (names only), and `/api/health`
  turns red (503). Same code in dev, staging and production.
- **Staging links.** Done in batch 3 follow-up #170 (`appUrl`, `environment-links.spec.ts`
  checks that no staging page links to a production host). Re-verified by the staging smoke.
- **`/api/health`** in all three apps: `ok`, `app`, `environment`, `commit` (Vercel git SHA),
  `demoMode`, `database` (head request with the public key), `serviceKey`, every adapter as
  `real`, `fake` or `missing`, and `demoSignIn` on provider and admin in demo mode. Never values.
- **Admin > Settings > System status** shows the three apps side by side and the adapter matrix.
- **Staging smoke** (`.github/workflows/staging-smoke.yml`): after every staging deploy of the
  website, waits until all three staging hosts report the deployed commit, then runs
  `staging-smoke.spec.ts` (health green on that commit; Get Help reaches the quotes screen in
  demo mode) and `demo-sign-in.spec.ts` (all four roles). Opens a `critical` issue on failure.
  Release QA runs the same specs.
- Real or demo: real. Keys: Supabase only. Tested: unit tests for the key check and adapter
  states, e2e health and smoke specs. Owner: nothing.

### RSOS-021b: Real maps and SMS codes

- **Adapters** (`packages/core/src/adapters/`): `maps` (Places Autocomplete (New), place details,
  reverse geocoding with nearest highway, Routes; fake: echoed suggestion at the city centre,
  straight-line routes) and `twilio` (Verify start/check; fake: fixed code `000000`, never in
  production; webhook signature check). Screens never import a vendor SDK.
- **Get Help**: the address field is an accessible combobox fed by `/api/places` (server key,
  US only, biased to the chosen city, 60 lookups per IP per minute). Picking a suggestion gives the
  exact point; GPS fixes get a readable address and nearest highway. Real map (`GoogleMap`:
  Maps JavaScript API, Advanced Markers with our own glyphs, light and dark) wherever a browser key
  is set, the schematic map otherwise.
- **Codes**: the driver's phone check uses Twilio Verify (was our own code generation). Provider
  and admin apps gain "Sign in with a text code" (Verify, then a one-time session for the account
  with that phone). With the fake verifier only demo accounts can sign in this way.
- **Rate limits**: 3 codes per phone per 10 minutes, 10 per IP per hour (demo-mode hosts allow
  more for test suites). Upstash is still missing, so limits use a **Postgres-backed limiter**
  (`rate_limit_hit`), shared by every server instance, with an in-memory fallback.
- **Budget guard**: every real Maps and Verify call is counted per day (`api_usage`). Admin >
  Settings > System status shows today's usage and lets super admins set daily thresholds; the
  team inbox gets one email per service per day when a threshold is passed.
- Real or demo: built for real, running on **fakes** (no Google or Twilio keys). Keys:
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, optional
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID`. Tested: adapter unit tests (real and fake, including Twilio's
  documented signature example), pgTAP for limits, usage and the phone lookup, e2e for the
  combobox, the Places endpoint and SMS sign-in. Owner: create and restrict the Maps keys
  (`docs/runbooks/google-maps.md`), create the Verify service, add the keys in Vercel.
- **BLOCKED (keys missing)**: real map and autocomplete on staging; a Verify code reaching
  `OWNER_TEST_PHONE`.

### RSOS-030: Call tracking and the phone flow (IVR)

- **Tracking numbers**: the existing `market_phone_numbers` table is the tracking-number table
  (E.164, market, source, active), with new sources `gmb`, `bing` and `staging_test`. Admin >
  Settings > Phone numbers adds them (market, source, label), turns them on and off, and syncs
  with Twilio (read-only: stamps the Twilio SID on numbers it finds).
- **Incoming calls** (`/api/twilio/voice` on the admin host; the admin app holds the server key):
  signature checked (403 otherwise), idempotent per CallSid (`webhook_events`). Creates the `calls`
  row and a `phone_intake` request with the dialed number's market and source. Flow: greeting
  with the brand name, "If you are in danger, hang up and call 9 1 1", recording notice only where
  the market enables recording, then every Available on-duty dispatcher's browser at once, then
  the on-duty mobiles, then voicemail with transcription.
- **Missed calls and voicemails** mark the request urgent, add it to the timeline and **email** the
  on-duty dispatchers. No text is sent to the caller (scope change: no SMS in this batch); the
  dispatcher gives the location link on the call back (RSOS-023).
- **Status callbacks** store duration and outcome; recordings stay in Twilio and play only through
  `/api/calls/<id>/recording` for signed-in staff who can see that market.
- **On duty**: weekly shifts per dispatcher (managers edit), "I am on duty now" toggle, presence
  and mobile number (Admin > Settings > On duty).
- **Dynamic number insertion**: the proxy remembers each visitor's first-touch source for 90 days
  (`rsos_src`); tap-to-call links carry `data-dni`, and a tiny script swaps in that source's number
  from `/api/phone` (cached). Pages stay static; visitors without an ad source run no request.
- Heavy work after a webhook runs with Next.js `after()` (the response returns at once), with
  idempotency on every event. A pgmq queue was not added: the work is a few database writes and one
  text, and retries come from Twilio's own redelivery plus the unique keys.
- Real or demo: built for real, running on **fakes** (no Twilio keys): webhooks accept the
  published test token outside production only; alert emails use the Resend fake. Keys:
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`. Tested: TwiML and
  source unit tests, pgTAP (`021_call_tracking`: RLS per role, idempotency, intake rules, on-duty),
  e2e (unsigned 403, the full call flow with signed fake webhooks, idempotent repeat, DNI cookie).
  Owner: buy numbers and point their webhooks per `docs/runbooks/twilio.md`, add the numbers in
  Admin > Settings > Phone numbers, set the on-duty schedule and mobiles.
- **BLOCKED (keys missing)**: ringing the admin softphone from the staging number.

### RSOS-034b: Real inbox and manual dispatch

- **Live inbox** (`/inbox`, new nav item): new web requests, phone intakes, calls, missed calls
  and voicemails in one list, newest first, urgent items on top, unread and unassigned counts, a
  market filter. It updates live through Supabase Realtime (requests, request events, calls,
  dispatch attempts), with RLS so dispatchers see only their markets.
- **Claiming**: one dispatcher owns a request; a claim lapses after 10 minutes without action;
  others see who has it and can take over.
- **Request panel**:
  - the manual steps: Contacted, Location confirmed, Provider assigned, On the way, Arrived,
    Completed, plus Cancelled and No provider found, each needing a reason;
  - the intake form for phone requests: name, service, address, vehicle and notes. The typed
    address is checked for format only; with Google Maps off, the dummy places it at the market
    centre;
  - nearby active providers for that service, nearest first, with price, last response time and
    acceptance rate;
  - provider call outcomes: no answer, declined, quoted;
  - Assign, which writes a `manual_test` fee row (nobody is charged);
  - notes, the timeline, and the softphone Call buttons.
- **Telling the driver, with no SMS (owner scope change):**
  - Assigning, or pressing **Location link**, emails the driver when the request has an email
    (product email through the Resend fake). Each email is logged on the timeline.
  - Without an email, the panel shows the words to read on the call, and **I read it to the
    driver** logs it on the timeline.
  - No texts are sent. Incoming texts are handled in RSOS-035 behind a flag that is off.
- Real or demo: real. Keys: none beyond Supabase. Tested:
  - pgTAP `022_manual_dispatch` (RLS per role, claim lapses, forward-only steps, reasons, the fee
    row);
  - e2e `inbox-dispatch.spec.ts`: a signed missed call becomes an urgent item; the dispatcher
    claims it, records the intake, reads the location link and ends it with a reason.
- Owner: nothing.

### RSOS-089-prep: Test campaign kit

- **A real launch checklist per market** (Admin > Markets > a market), with six items:
  - tracking numbers: website and Google Ads;
  - at least N active, non-demo providers for every enabled service (N is per market, default 3);
  - prices and fees set;
  - on-duty dispatch covering 24/7;
  - an English landing page;
  - conversion tracking seen in the last 30 days.

  Going live is blocked until every item is green. A super admin can override with a written
  reason, which goes to the audit log. Ops managers cannot override.

- **Campaign analytics** (`/campaign`):
  - per market and day: requests, contacted within 2 minutes, assigned, completed, average time
    to contact and to assign, quoted job value, and the `manual_test` fees that would have been
    earned;
  - a CSV export for the owner.
- **Dispatch playbook** (`docs/runbooks/dispatch-playbook.md`): the steps for every request, the
  scripts for calls (safety first, providers, assigning), no-provider and dangerous-location
  scripts, price disputes, and recording outcomes. Written for this campaign with no texts: the
  driver is told by email or on the call, and the location link is a code read on the call.
- Real or demo: real. Keys: none. Tested:
  - pgTAP `026_campaign_kit` (visitors cannot read the checklist; missing items block going live;
    only super admins override; the override is audited);
  - unit tests for the campaign metrics and CSV;
  - e2e `campaign-kit.spec.ts`.
- Owner: set the minimum providers per service for each market before launch, and onboard at least
  that many real providers per service.

### RSOS-031: Ad tracking and attribution

- **First touch.** On a visitor's first request, the website's proxy stores the click ids (gclid,
  gbraid, wbraid, fbclid, msclkid), the UTM fields, the landing page, the referrer host and the
  market. They go in an HttpOnly cookie for 90 days, and the visit is counted per day, market and
  source (`record_visit`).
  - Get Help merges this first touch into the request's attribution.
  - The source cookie also drives the call-tracking number swap.
- **Conversion events, server side.** Database triggers write one event per id, deduplicated:
  request submitted, call started, call qualified (over 60 seconds), job assigned, job completed.
  Each carries the click ids, the source and the job value.
- **Admin > Marketing** (marketing, finance, ops and super admins):
  - per market and source for a date range: visits, calls, qualified calls, forms, requests,
    assigned, completed, spend, cost per lead and per job;
  - daily ad spend entry (manual until the ad APIs are connected);
  - a **Google Ads offline conversions** CSV download.
- **Meta Conversions API**: sent by Vercel Cron, only with `META_CAPI_ENABLED=true` and its keys
  (off now; event ids dedupe with the browser pixel).
- **Google Tag Manager** loads only after the visitor accepts analytics cookies (Consent Mode
  defaults to denied) and only with `NEXT_PUBLIC_GTM_ID`. It also gets a `call_click` event.
  Nothing extra loads on marketing pages without consent (the 150 KB budget holds).
- Real or demo: real (server-side counting and events). Keys: GTM, GA4, Google Ads and Meta ids
  are missing, so nothing goes to ad platforms yet. Tested:
  - unit `analytics.test.ts` (CSV format, CAPI payload and hashing, off without keys);
  - pgTAP `025_ad_tracking` (RLS: marketing reads, dispatchers cannot enter spend; triggers and
    dedupe; the report counts a qualified call);
  - e2e `ad-tracking.spec.ts`.
- Owner:
  - add `NEXT_PUBLIC_GTM_ID` (and GA4, Google Ads conversion ids, Meta pixel) when the campaign
    accounts exist;
  - `CRON_SECRET` on rsos-admin;
  - upload the offline conversions CSV in Google Ads weekly, or connect the API later.

### RSOS-035: Texts and emails, opt-outs, A2P 10DLC (texting built behind a flag, off)

- **Owner scope change: no SMS in this batch.** Everything for texts is built and tested with fakes
  behind `TEXTING_ENABLED`, which is off everywhere:
  - `sendText` sends and records nothing while the flag is off;
  - the incoming-text webhook (`/api/twilio/messages`) answers 404;
  - real sends also need the Twilio Messaging keys.
- **When switched on** (the flag plus the Messaging keys):
  - Opted-out numbers are blocked in our code too, not only at Twilio. STOP, START and HELP are
    handled, and HELP answers with the brand and support contact.
  - The first text to a number carries the STOP notice.
  - Quiet hours run from 9 pm to 8 am in the market's time zone, for non-urgent texts only.
  - Until A2P 10DLC is approved, real texts go only to test numbers (staff mobiles and
    `OWNER_TEST_PHONE`), unless the owner sets the override.
  - Delivery is reported through the status callback.
- **Admin > Settings > Texts**:
  - says texting is off, with the A2P 10DLC status and override;
  - shows the editable templates (English and Spanish) in `sms_templates`.

  The "texts limited" banner appears only once texting is on.

- **Emails through the Resend fake** (Resend comes after the final domain): a provider
  application approved email (with an Approve button in recruitment), and a daily dispatch summary
  for the owner (Vercel Cron, `CRON_SECRET`).
- **Runbook:** `docs/runbooks/a2p-10dlc.md` (brand and campaign registration, sample messages,
  opt-in wording). The privacy policy gains a "Text messages" section for when texting starts.
- Real or demo: fakes and tests only, by the owner's decision. Keys: none now. Tested:
  - unit `texting.test.ts` (the flag, the fake, keywords, quiet hours, the send decision order);
  - pgTAP `024_texts_and_compliance` (templates and settings RLS, delivery report);
  - e2e `admin-settings.spec.ts` (the Texts tab).
- Owner:
  - register A2P 10DLC when texting is wanted;
  - then set `TEXTING_ENABLED=true` with the Messaging keys;
  - set `CRON_SECRET` on rsos-admin for the daily summary.

### RSOS-023: Location link

- **The driver's page** (`/l/<token>` on the website) is one small HTML document. Its CSS comes
  from our tokens (light and dark), and its script (about 3 KB, CSP nonce) needs no JavaScript
  bundle, so it works on slow 3G.
  - **Share my location** uses the browser's GPS and stores the coordinates. With Google Maps off,
    it shows them as text.
  - A typed address fallback is checked for format only; no geocoding.
  - Also: an optional landmark note and an optional vehicle photo (private `job-photos` bucket).
  - The link lasts 2 hours and covers one request. The token is unguessable, and every read and
    write goes through definer functions that check it.
- **No SMS (owner scope change).** Each link comes with a 6-digit code.
  - When the request has an email, the dispatcher's **Location link** emails the link and the
    code.
  - Otherwise the panel shows "Go to {site}/l and type the code 482 917" to read on the call.
  - The driver types the code at `/l`, which opens their link. Lookups are limited to 10 per IP
    per 10 minutes, and a used link's code stops working.
- When the driver shares, the request's pin and address update, it is marked urgent, and the
  timeline says "Driver shared location"; the inbox sees it live.
- Real or demo: real. Keys: none. Tested:
  - pgTAP `023_location_links` (valid, expired and unknown tokens, the code lookup, US-only
    points);
  - e2e `location-link.spec.ts`: a missed call, the code read on the call, the driver types it,
    shares GPS (375 px), and the dispatcher sees it; a made-up token gets the friendly expired
    page.
- Owner: nothing.

### RSOS-074b: Real browser softphone for dispatchers

- **Softphone dock** on every admin screen for super admins, ops managers and dispatchers: presence
  (Available, Busy, Away: only Available dispatchers are rung), incoming call screen with caller,
  market, source and linked request, answer, decline, mute, hold (the caller hears music; resume
  rings this browser again), transfer to another Available dispatcher, hang up.
- **Access tokens** minted on the server (`softphoneTokenAction`): Twilio Voice JWT signed with the
  API key secret, 1 hour, identity = the dispatcher's user id, refreshed before expiry; refused for
  other roles.
- **Outbound calls** from request pages ("Call driver") and the inbox (driver, provider) through
  the TwiML App (`/api/twilio/client`, signature-checked): caller ID is the market's tracking
  number; each call is logged in `calls` and on the request timeline.
- **Microphone**: an explanation and an "Allow microphone" button before the first call; a clear
  message on unsupported browsers (Voice SDK `Device.isSupported`). The Voice SDK (2.18.4) loads
  only when Twilio is connected.
- Real or demo: built for real, **demo mode** without keys (the dock shows that calls are not
  connected). Keys: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`,
  `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID` (admin). Tested: token and live-call unit tests,
  e2e (dock on every screen, presence saved, TwiML App rejects unsigned requests). Owner: create
  the API key and the TwiML App per environment (`docs/runbooks/twilio.md`).
- **BLOCKED (keys missing)**: answering a staging call in the browser; calling `OWNER_TEST_PHONE`
  from a request page.
