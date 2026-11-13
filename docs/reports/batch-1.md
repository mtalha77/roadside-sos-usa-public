# RSOS Batch 1: run report

- Run started: 2026-11-12 23:47 UTC (stop at about 02:47 UTC)
- Repository: `mtalha77/roadside-sos-usa-public`. The batch file names `mtalha77/roadside-sos-usa`; that private repository was deleted after RSOS-003 because GitHub Free cannot protect branches on private repositories.
- Supabase organization: **mtalha77's Org** (`vtcdceoqxcuqqrztdvha`). No organization is named "Roadside SOS USA" and there are three organizations, so the personal one was used. It is a paid organization (8 existing projects); the owner approved the extra monthly compute for three new projects before they were created.

## Summary

| Ticket   | Status      | Pull request                                                     |
| -------- | ----------- | ---------------------------------------------------------------- |
| RSOS-004 | Done        | [#2](https://github.com/mtalha77/roadside-sos-usa-public/pull/2) |
| RSOS-005 | In progress | (this PR)                                                        |

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

## RSOS-005: Vercel projects, environments and domains

Team: **Muhammad Talha's projects** (`muhammad-talhas-projects-e2b4ee4c`), plan **Pro**, so no plan blocker.

| Project         | Root directory  | Production domain(s)                     | Staging branch domain               | Preview protection |
| --------------- | --------------- | ---------------------------------------- | ----------------------------------- | ------------------ |
| `rsos-web`      | `apps/web`      | fixallcontractors.com, www (308 to apex) | staging.fixallcontractors.com       | Public, noindex    |
| `rsos-provider` | `apps/provider` | pro.fixallcontractors.com                | staging-pro.fixallcontractors.com   | Vercel Auth        |
| `rsos-admin`    | `apps/admin`    | admin.fixallcontractors.com              | staging-admin.fixallcontractors.com | Vercel Auth        |

- Node: Vercel set **26.x**, matching `.nvmrc` (26.13.0); no change needed.
- "Skip unaffected projects" is on for all three (only apps a commit changes are built).
- Production branch `main`; the `staging` branch is assigned to the staging domains.
- Environment variables (piped from the Supabase CLI, never printed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_ENV`, `NEXT_PUBLIC_SITE_URL`; `SUPABASE_SERVICE_ROLE_KEY` (sensitive) on `rsos-admin` only. Production uses `rsos-prod`; the `staging` branch uses `rsos-staging`; other previews and Development use `rsos-dev`.
- Variables are validated with Zod at build time (`validateAppEnv` in each `next.config.ts`); a Vercel build with a missing variable fails and names it.
- Non-production hosts and all provider/admin hosts send `X-Robots-Tag: noindex, nofollow` and a disallow-all `robots.txt`. Vercel also marks `*.vercel.app` preview URLs noindex.
- `@vercel/analytics` and `@vercel/speed-insights` are added to `rsos-web`.

DNS records for fixallcontractors.com (DNS host: stackdns.com nameservers). **Do not change anything yet except the apex**; the five subdomains already resolve to Vercel.

| Hostname                            | Type   | Name            | Value                                        | Status now                             |
| ----------------------------------- | ------ | --------------- | -------------------------------------------- | -------------------------------------- |
| fixallcontractors.com               | A      | `@`             | `216.150.1.1`                                | **Change needed**                      |
| fixallcontractors.com               | A      | `@`             | `216.150.16.1`                               | **Change needed** (add)                |
| fixallcontractors.com               | A/AAAA | `@`             | delete `185.151.30.209` and `2a07:7800::209` | **Conflicting, remove**                |
| www.fixallcontractors.com           | CNAME  | `www`           | `2aa3b310123237e4.vercel-dns-016.com.`       | OK (currently `cname.vercel-dns.com.`) |
| staging.fixallcontractors.com       | CNAME  | `staging`       | `2aa3b310123237e4.vercel-dns-016.com.`       | OK (currently `cname.vercel-dns.com.`) |
| pro.fixallcontractors.com           | CNAME  | `pro`           | `ffeec8e2c3750e7f.vercel-dns-016.com.`       | OK (currently `cname.vercel-dns.com.`) |
| staging-pro.fixallcontractors.com   | CNAME  | `staging-pro`   | `ffeec8e2c3750e7f.vercel-dns-016.com.`       | OK (currently `cname.vercel-dns.com.`) |
| admin.fixallcontractors.com         | CNAME  | `admin`         | `0abd3939185a2c23.vercel-dns-016.com.`       | OK (currently `cname.vercel-dns.com.`) |
| staging-admin.fixallcontractors.com | CNAME  | `staging-admin` | `0abd3939185a2c23.vercel-dns-016.com.`       | OK (currently `cname.vercel-dns.com.`) |

No TXT verification records are needed: all six domains are already verified on the Vercel team. Switching the CNAMEs from `cname.vercel-dns.com.` to the project-specific values is optional (Vercel's recommendation).

Acceptance criteria:

| #   | Criterion                                                           | Result                          |
| --- | ------------------------------------------------------------------- | ------------------------------- |
| 1   | Every pull request gets preview links for the apps it changes       | Pending (this PR)               |
| 2   | Merging to `staging` updates the three staging hosts                | Pending (merge)                 |
| 3   | All hostnames serve over HTTPS; non-production hosts send `noindex` | Pending (merge; apex needs DNS) |

## BLOCKERS

1. **DNS for the apex domain (RSOS-005).** At your DNS host for fixallcontractors.com (nameservers `ns1-4.stackdns.com`): delete the `@` A record `185.151.30.209` and the `@` AAAA record `2a07:7800::209`, then add `@` A `216.150.1.1` and `@` A `216.150.16.1`. Vercel issues the certificate automatically within minutes.
2. **Turn on Web Analytics and Speed Insights for `rsos-web` (RSOS-005).** Vercel dashboard, project `rsos-web`, Analytics tab, Enable; then Speed Insights tab, Enable. The code is already installed; data starts after the next deployment.
