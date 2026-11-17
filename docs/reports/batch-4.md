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
| RSOS-074b Real browser softphone                    | Not started              |                                                                      |
| RSOS-034b Real inbox and manual dispatch            | Not started              |                                                                      |
| RSOS-023 Location link                              | Not started              |                                                                      |
| RSOS-035 Real texts and emails, opt-outs, A2P 10DLC | Not started              |                                                                      |
| RSOS-031 Ad tracking and attribution                | Not started              |                                                                      |
| RSOS-089-prep Test campaign kit                     | Not started              |                                                                      |
| RSOS-036 Release QA and first production release    | Not started              |                                                                      |

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
| TWILIO_VERIFY_SERVICE_SID                                                                                                   | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| TWILIO_MESSAGING_SERVICE_SID                                                                                                | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| TWILIO_TWIML_APP_SID                                                                                                        | n/a                                       | n/a                                           | missing / missing / missing                |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY                                                                                             | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| GOOGLE_MAPS_SERVER_KEY                                                                                                      | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| RESEND_API_KEY                                                                                                              | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY                                                                       | present / present (via Preview) / present | n/a                                           | n/a                                        |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN                                                                           | missing / missing / missing               | missing / missing / missing                   | missing / missing / missing                |
| NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA4_ID, GOOGLE_ADS_CONVERSION_ID + labels, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_MS_UET_ID | missing / missing / missing               | n/a                                           | n/a                                        |
| OWNER_TEST_PHONE                                                                                                            | missing (staging)                         | missing (staging)                             | missing (staging)                          |
| SUPABASE_SERVICE_ROLE_KEY                                                                                                   | not used (by design)                      | present / present / **missing**               | present / present / present                |

Twilio phone numbers and Messaging Service attachments: **not checked (BLOCKED)**, no Twilio
credentials. Consequence, per the batch rules: every Twilio, Maps, email, rate-limit and
ad-tracking feature is built against its fake adapter, and the real-wiring acceptance criteria are
BLOCKED until the owner adds the keys. `rsos-provider` Production has no `SUPABASE_SERVICE_ROLE_KEY`
(needed before release: RSOS-036 check 6).

## Tickets

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
- **Missed calls and voicemails** mark the request urgent, add it to the timeline and text the
  on-duty dispatchers. **Auto text** to the caller after the call connects or reaches voicemail:
  a location link, once per call, only to mobile numbers (Twilio Lookup) that have not opted out.
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
  published test token outside production only, texts and lookups are recorded, not sent. Keys:
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`. Tested: TwiML and
  source unit tests, pgTAP (`021_call_tracking`: RLS per role, idempotency, intake rules, on-duty),
  e2e (unsigned 403, the full call flow with signed fake webhooks, idempotent repeat, DNI cookie).
  Owner: buy numbers and point their webhooks per `docs/runbooks/twilio.md`, add the numbers in
  Admin > Settings > Phone numbers, set the on-duty schedule and mobiles.
- **BLOCKED (keys missing)**: ringing the admin softphone from the staging number, the
  location-link text reaching `OWNER_TEST_PHONE`.
