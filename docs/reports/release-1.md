# Release 1 ("test campaign ready"): Release QA

- Date: 2026-11-17. Ticket: RSOS-036. Staging commit checked: `23c3924` (RSOS-021c, #176).
- **Result: NOT RELEASED.** Several checks fail (below), so no `staging` → `main` pull request
  was opened, nothing was merged into `main`, and no `v0.1.0` tag exists. Production is unchanged.

## Checks

| #   | Check                                                   | Result      | Evidence or what is missing                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every required CI check green on `staging`              | **FAIL**    | CI passed on `23c3924`, but `lint` now fails on every branch: `pnpm audit` reports GHSA-fc5q-39xc-vjpf (picomatch ReDoS, high, no patched version). Accepting it is an owner decision (run report, "Run blocker").                                                      |
| 2   | All batch 4 tickets merged into `staging`               | **FAIL**    | RSOS-074b (#177) is green apart from that audit step; RSOS-034b, 023, 035, 031 and 089-prep are built on stacked branches and wait for it.                                                                                                                              |
| 3   | Staging smoke (health on the deployed commit, Get Help) | PASS        | `Staging smoke` workflow succeeded on `23c3924`.                                                                                                                                                                                                                        |
| 4   | Staging database deploy                                 | **FAIL**    | Migrations are applied, but the "no fake data" check fails on the staging smoke's own request, which also skipped the Auth email-code configuration. Fixed on `rsos-034b-inbox-dispatch`, not merged yet.                                                               |
| 5   | Security: no ERROR-level Supabase advisors              | PASS        | Staging and production: none. Staging warnings: intended public definer functions; leaked-password protection is off (owner: turn it on in Supabase Auth).                                                                                                              |
| 6   | Production keys present                                 | **FAIL**    | rsos-provider Production has no `SUPABASE_SERVICE_ROLE_KEY`. No Twilio voice keys (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`) in any environment. Maps, texts and Resend: deferred by the owner. |
| 7   | Monitoring and uptime                                   | **FAIL**    | No Sentry DSN and no uptime monitor in any project.                                                                                                                                                                                                                     |
| 8   | Owner super admin in production                         | **FAIL**    | rsos-prod has no migrations applied yet (they run on the merge to `main`) and no staff accounts.                                                                                                                                                                        |
| 9   | Demo mode off in production                             | PASS (code) | `isDemoMode()` is always false when `NEXT_PUBLIC_SITE_ENV=production` (unit tested). It cannot be checked live: production still runs RSOS-005, which has no `/api/health`.                                                                                             |
| 10  | Rollback plan                                           | Ready       | See below.                                                                                                                                                                                                                                                              |

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

1. The owner decides on GHSA-fc5q-39xc-vjpf: accept it in `pnpm-workspace.yaml`
   (`auditConfig.ignoreGhsas`, with the reason) or wait for a picomatch fix. Then merge #177 and
   the stacked branches, one pull request at a time.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to rsos-provider Production.
3. Add a Sentry DSN to each app, and an uptime monitor on the three `/api/health` endpoints.
4. Create the owner's super admin in production after the first migration run.
5. Twilio voice keys and TwiML Apps (`docs/runbooks/twilio.md`). Without them the phone features
   stay on the fake, which is acceptable for a web-only test campaign if the owner says so.
6. Run this Release QA again. When every check passes, open "Release 1: test campaign ready" from
   `staging` to `main`, merge it after `release-qa` passes, and tag `v0.1.0`.
