# RSOS Batch 4: run report

- Run started: 2026-11-16. No time limit.
- Spec: `docs/batches/rsos-batch-4.md`. Same operating rules as batches 2 and 3.
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the
  first ticket not marked Done.

## Summary

| Ticket                                              | Status      | Pull request |
| --------------------------------------------------- | ----------- | ------------ |
| Step 0 Key check                                    | Done        | (this file)  |
| RSOS-099 Staging fixes before new work              | In progress |              |
| RSOS-021b Real maps and SMS codes                   | Not started |              |
| RSOS-030 Call tracking and the phone flow (IVR)     | Not started |              |
| RSOS-074b Real browser softphone                    | Not started |              |
| RSOS-034b Real inbox and manual dispatch            | Not started |              |
| RSOS-023 Location link                              | Not started |              |
| RSOS-035 Real texts and emails, opt-outs, A2P 10DLC | Not started |              |
| RSOS-031 Ad tracking and attribution                | Not started |              |
| RSOS-089-prep Test campaign kit                     | Not started |              |
| RSOS-036 Release QA and first production release    | Not started |              |

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
