# Release 1: Road Rescue SOS soft launch (v0.1.0)

**Released 2026-11-23** by merging #212 (`staging` → `main`, merge commit `72e5f3e`) at 19:56 UTC,
with the owner's approval to launch with the exceptions below. Tag: `v0.1.0`.

## Release QA (RSOS-036), 2026-11-23

| #   | Check                               | Result                  | Evidence                                                                                                                                                                                                               |
| --- | ----------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CI green on `staging`               | PASS                    | Every required check on `2da347d`; `release-qa` (full regression and Lighthouse against staging) green on that commit.                                                                                                 |
| 2   | Staging smoke and the Get Help flow | PASS                    | Staging smoke 15/15 on the roadrescuesos.com hosts; staff sign-in checked on staging-admin.                                                                                                                            |
| 3   | Security                            | PASS with one exception | Supabase advisors: no ERROR on staging or production. The code-review fix (#207) closed the staff-guard bypass. Webhooks reject unsigned requests (e2e). **Exception: rate limiting is not active (no Upstash keys).** |
| 4   | Demo mode impossible in production  | PASS                    | `/api/health` reports `demoMode: false` on all three apps; no demo badge or "Sign in as demo" renders; demo tokens show "We couldn't find that request"; `isDemoMode()` is false in production by code (unit tested).  |
| 5   | Production database                 | PASS (owner step after) | All migrations applied to `rsos-prod`, database tests and the no-fake-data check pass. **The owner's super admin can only be created after this first deploy** (`docs/runbooks/super-admin.md`).                       |
| 6   | Production keys                     | PASS with exceptions    | Supabase, service key (matches on provider and admin), Resend email and website Turnstile are real. **Exceptions: Twilio (phones off), Turnstile on the provider and admin apps, Google Maps deferred.**               |
| 7   | Monitoring                          | PASS with exception     | Uptime workflow checks the three `/api/health` endpoints every 15 minutes and alerts the owner. **Exception: no Sentry.**                                                                                              |
| 8   | Rollback plan                       | Ready                   | Below.                                                                                                                                                                                                                 |

After the deploy: roadrescuesos.com, `pro.` and `admin.` all report commit `72e5f3e`, environment
`production`, database ok; `www` redirects to the apex; no console errors on the home page, Get Help
and both sign-in pages; Vercel runtime logs watched for 15 minutes (19:57 to 20:15 UTC, 117
requests across the three apps, all 2xx or 3xx): info entries only, no warnings, errors or
fatals.

## Accepted exceptions

Owner decisions on 2026-11-23, after the v0.1.0 deploy. Anything not listed here is not waived.

| Item            | Decision                          | Date       | Reason                                                                            | Condition                                                                                                                                                                                                                     | Owner                                |
| --------------- | --------------------------------- | ---------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Rate limiting   | **Not waived**: fixed in v0.1.1   | 2026-11-23 | Public forms, sign-in codes and request creation must not be floodable at launch. | None: shipped as the Postgres limiter (below). Upstash stays optional: setting `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` switches the store with no code change.                                                | Engineering                          |
| Twilio / phones | Accepted                          | 2026-11-23 | Booking is web-only for the soft launch.                                          | Phones stay off in production until the RingCentral connection (`docs/batches/rsos-ringcentral.md`), which the owner will ask for.                                                                                            | Owner (asks), Engineering            |
| Sentry          | Accepted for the soft launch only | 2026-11-23 | No paid traffic yet; uptime checks cover outages.                                 | Sentry live in all three apps **before any paid ads start**. Enforced: "Sentry live" is a required go-live item for every market, and no ad platform can be switched on without it (database check, shown on Ad connections). | Engineering (SDK), Owner (DSN)       |
| Super admin     | Accepted                          | 2026-11-23 | The account can only be created after the first production deploy.                | Created in `rsos-prod` within 1 hour of the release, with the steps in the post-release checklist below.                                                                                                                      | Owner (step 1), Engineering (step 2) |

### Rate limiting as shipped (v0.1.1)

Limits live in `packages/config/src/rate-limits.ts` (per IP, per email or phone, per market) and
are counted in Postgres (`rate_limit_hit`), shared by every server instance; old windows are swept
nightly. Covered: Get Help (creates a request), contact form, provider application, waitlist,
email sign-in codes, provider email links and phone codes, cookie choices and the funnel beacon.
`/api/health` reports `adapters.rateLimit: "real"` and `rateLimitBackend: "postgres"`, proven by
a counted probe on every health check.

## Post-release checklist

Within 1 hour of the release:

1. **Super admin, step 1 (owner).** Supabase dashboard → project `rsos-prod` → Authentication →
   Users → Add user → Create new user. Enter your email and a strong password, tick **Auto Confirm
   User**, then Create user.
2. **Super admin, step 2 (engineering, or the owner in the SQL editor of `rsos-prod`).** Make that
   user the owner (replace the email):

   ```sql
   insert into public.staff_members (user_id, role, display_name)
   select id, 'super_admin', 'Owner' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'super_admin', is_active = true;
   ```

3. **Sign in.** Go to `admin.` + the main domain → Sign in with that email and password. Set up
   the authenticator app when asked (staff need two-factor sign-in), then sign out and in again.
4. **Check.** Settings → System status shows all three apps healthy, `Rate limits` Real, and
   `Error tracking (Sentry)` Missing (the accepted exception). Marketing → Ad connections shows
   "Sentry: Not live", with every platform's Switch on disabled.
5. **Dummy providers.** Six `[Dummy]` providers stay until the owner says to remove them.

## What is live

- **Customers:** the website, the Get Help request flow with per-service questions, the tracking
  page with "Report a problem", accounts, and the legal pages (approved by the attorney).
- **Staff:** the admin with the Inbox and manual dispatch, flags, markets, pricing, wallet
  credits, test traffic, ad connections (all platforms off until keys) and analytics.
- **Providers:** applications, sign-in, profile, services, prices and wallet.
- **Dispatch:** six `[Dummy]` providers (two per live market, fictional 555-01xx numbers) so staff can assign requests until
  real providers are approved. The owner decides when to remove them.

## Behind flags (off in production)

| Flag                  | What it hides                                                                               | Turn on when                         |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| `providerMarketplace` | Provider offers, jobs, insights, team activity and home counts (still on the demo scenario) | The quote engine (batch 5) is built. |

Off until keys exist (not flags): Twilio calls and texts, Google Maps, ad platform sync, Meta and
Google conversion uploads, Sentry (paid ads blocked until it is live).

## Rollback

Production before this release (RSOS-005 scaffold):

- rsos-web `dpl_6NGbpHHy4tHbp2HmJ4eQN21LPCH6`
- rsos-provider `dpl_APnbci3UJTDNYAF8dtqD6SsKYZ72`
- rsos-admin `dpl_3sAVmcr6mDoPYtDvwPuvsEYhqVjw`

Vercel → project → Deployments → the previous production deployment → Instant Rollback. The
database changes are additive, so the old apps keep working against the new schema.

## Owner actions

1. Create the first super admin (`docs/runbooks/super-admin.md`).
2. Sentry: the SDK ticket, then a DSN for the three apps, before any paid ads (Upstash is optional).
3. Turnstile site and secret keys on the provider and admin projects (production).
4. Twilio production keys when phones should go live (`docs/runbooks/twilio.md`).
5. Supabase: turn on leaked-password protection; confirm backups (PITR) on `rsos-prod`.
6. Send the RSOS-118 file (`~/Downloads/rsos-domain-move.md` was not found).

From now on releases follow the weekly train (`docs/release-train.md`).

---

# Earlier attempt (2026-11-17)

- Date: 2026-11-17 (re-run after every batch 4 ticket merged). Ticket: RSOS-036. Staging commits
  checked: `6541426` (RSOS-031, #182) and this pull request (RSOS-089-prep).
- **Result: NOT RELEASED.** The code is ready, but production keys, monitoring and the owner's super
  admin are missing (checks 6 to 8), so no `staging` → `main` pull request was opened, nothing was
  merged into `main`, and no `v0.1.0` tag exists. Production is unchanged.

## Checks

| #   | Check                                                   | Result      | Evidence or what is missing                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every required CI check green on `staging`              | PASS        | CI, database deploy and staging smoke green on `6541426`. The picomatch advisory (GHSA-fc5q-39xc-vjpf) was accepted by the owner and is listed in `pnpm-workspace.yaml`.                                                                                                           |
| 2   | All batch 4 tickets merged into `staging`               | PASS        | #172, #175, #173, #176, #177, #179, #180, #181, #182, and RSOS-089-prep in this pull request.                                                                                                                                                                                      |
| 3   | Staging smoke (health on the deployed commit, Get Help) | PASS        | `Staging smoke` workflow succeeded on `2af35b6` and on every later staging commit.                                                                                                                                                                                                 |
| 4   | Staging database deploy                                 | PASS        | Migrations, database tests, Auth configuration (email codes) and the "no fake data" check all pass since #179.                                                                                                                                                                     |
| 5   | Security: no ERROR-level Supabase advisors              | PASS        | Staging and production: none (re-checked after all batch 4 migrations). The RSOS-031 trigger functions no longer accept API calls (`20261116090000`). Staging warnings: intended public definer functions; leaked-password protection is off (owner: turn it on in Supabase Auth). |
| 6   | Production keys present                                 | **FAIL**    | rsos-provider Production has no `SUPABASE_SERVICE_ROLE_KEY`. No Twilio voice keys (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`) in any environment. Maps, texts and Resend: deferred by the owner.            |
| 7   | Monitoring and uptime                                   | **FAIL**    | No Sentry DSN and no uptime monitor in any project.                                                                                                                                                                                                                                |
| 8   | Owner super admin in production                         | **FAIL**    | rsos-prod has no migrations applied yet (they run on the merge to `main`) and no staff accounts.                                                                                                                                                                                   |
| 9   | Demo mode off in production                             | PASS (code) | `isDemoMode()` is always false when `NEXT_PUBLIC_SITE_ENV=production` (unit tested). It cannot be checked live: production still runs RSOS-005, which has no `/api/health`.                                                                                                        |
| 10  | Rollback plan                                           | Ready       | See below.                                                                                                                                                                                                                                                                         |

## Rollback plan (for when it ships)

Production today (RSOS-005, commit `420501166494`):

- rsos-web `dpl_6NGbpHHy4tHbp2HmJ4eQN21LPCH6`
- rsos-provider `dpl_APnbci3UJTDNYAF8dtqD6SsKYZ72`
- rsos-admin `dpl_3sAVmcr6mDoPYtDvwPuvsEYhqVjw`

If Release 1 misbehaves:

1. Promote these three deployments again in Vercel (Deployments → Promote to Production).
2. The database is additive-only, so the old apps keep working against the new schema.
3. Revert the release merge on `main` with a pull request.

## To ship Release 1

1. Add `SUPABASE_SERVICE_ROLE_KEY` to rsos-provider Production.
2. Add a Sentry DSN to each app, and an uptime monitor on the three `/api/health` endpoints.
3. Create the owner's super admin in production after the first migration run.
4. Twilio voice keys and TwiML Apps (`docs/runbooks/twilio.md`). Without them the phone features
   stay on the fake, which is acceptable for a web-only test campaign if the owner says so.
5. Run this Release QA again. When every check passes, open "Release 1: test campaign ready" from
   `staging` to `main`, merge it after `release-qa` passes, and tag `v0.1.0`.
