# RSOS Batch 1: run report

- Run started: 2026-11-12 23:47 UTC (stop at about 02:47 UTC)
- Repository: `mtalha77/roadside-sos-usa-public`. The batch file names `mtalha77/roadside-sos-usa`; that private repository was deleted after RSOS-003 because GitHub Free cannot protect branches on private repositories.
- Supabase organization: **mtalha77's Org** (`vtcdceoqxcuqqrztdvha`). No organization is named "Roadside SOS USA" and there are three organizations, so the personal one was used. It is a paid organization (8 existing projects); the owner approved the extra monthly compute for three new projects before they were created.

## Summary

| Ticket   | Status      | Pull request |
| -------- | ----------- | ------------ |
| RSOS-004 | In progress | (this PR)    |

## RSOS-004: Supabase cloud projects and migration workflow

Projects (region us-east-1):

| Project        | Ref                    | GitHub variable               | GitHub secret (password)       |
| -------------- | ---------------------- | ----------------------------- | ------------------------------ |
| `rsos-dev`     | `lfujyujgmedaobbodasa` | `SUPABASE_PROJECT_ID_DEV`     | `SUPABASE_DB_PASSWORD_DEV`     |
| `rsos-staging` | `drmnvcwlebyikvakhaxj` | `SUPABASE_PROJECT_ID_STAGING` | `SUPABASE_DB_PASSWORD_STAGING` |
| `rsos-prod`    | `htrjopnxlwaecuwzafqo` | `SUPABASE_PROJECT_ID_PROD`    | `SUPABASE_DB_PASSWORD_PROD`    |

Passwords were generated with `openssl rand -base64 32` and piped straight into GitHub secrets; they were never printed or stored anywhere else.

Built:

- Migrations: extensions (postgis, pgcrypto, citext, pg_cron, pgmq, pg_net) and storage buckets (`provider-documents` private, `provider-media` public, `job-photos` private, `call-recordings` private, each with size and file-type limits).
- pgTAP test `supabase/tests/001_baseline.test.sql` (extensions installed, bucket visibility).
- CI `db` job (required check): links `rsos-dev`, applies migrations, runs database tests, sets Auth URLs. Skips with a notice only when secrets are unavailable (fork or Dependabot PRs).
- `db-deploy.yml`: merge to `staging` applies to `rsos-staging`; merge to `main` applies to `rsos-prod` (then tests and Auth URLs).
- Auth URLs (`scripts/supabase-auth-urls.sh`, hostnames from the `APP_DOMAIN` variable): dev = localhost + Vercel preview links (`VERCEL_TEAM_SLUG` variable); staging = staging, staging-pro, staging-admin; prod = apex, www, pro, admin.
- Types generated from `rsos-dev` into `packages/db/src/database.types.ts` (`pnpm --filter @rsos/db gen:types`). Each app has typed server and browser clients (`src/lib/supabase/`) and a `/api/health` route using them. The service role client stays server-only (`@rsos/db/admin` imports `server-only`).
- CLAUDE.md rule 4a: schema changes only through migrations; never edit any project in the dashboard.

Acceptance criteria:

| #   | Criterion                                                                      | Result                                                                   |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | Sample migration applied to `rsos-dev` by the PR, then to staging after merge  | Pending (CI run)                                                         |
| 2   | Generated types compile and are used by all three apps                         | PASS (typecheck and build pass; all three apps import the typed clients) |
| 3   | Previews use `rsos-dev`; staging and production domains use their own projects | Pending RSOS-005                                                         |

Production settings the owner must switch on in the Supabase dashboard for `rsos-prod` before launch (these are account settings, not schema):

1. **Point-in-time recovery** add-on (Project Settings, Add-ons). Daily backups are included on the paid plan; confirm they show under Database, Backups.
2. **Compute size**: start at Small or larger for production (Project Settings, Compute and Disk).
3. **SSL enforcement** on and **network restrictions** limited to known IPs if direct database access is needed (Database settings).
4. **Custom SMTP** (Resend) for auth emails, sender on the brand domain (Authentication, Emails, SMTP).
5. **Leaked password protection** and **MFA** for the dashboard organization members (Authentication, Providers; Organization, Security).
6. **Spend cap** decision for the organization (Billing).

## BLOCKERS

None yet.
