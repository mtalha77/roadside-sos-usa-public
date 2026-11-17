# Release 1 ("test campaign ready"): Release QA

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
