# RSOS Batch 1: autonomous run for Claude Code

Project: Roadside SOS USA (working name). Test domain: see `packages/config`.
Repository: github.com/mtalha77/roadside-sos-usa-public (the batch originally named the private repository, which was replaced because GitHub Free cannot protect private branches).
Project folder on this Mac: /Users/mtalha/Claude/roadside-sos-usa

This file tells you (Claude Code) exactly what to build in this run. Read all of it before starting.

---

## Operating rules for this run

1. Work only in /Users/mtalha/Claude/roadside-sos-usa. Read CLAUDE.md first and follow it.
2. Do the tickets in the order listed. For each ticket:
   - Create a branch `rsos-<id>-<short-slug>` from `staging`.
   - Build, write tests, run lint, typecheck, tests and build until all pass with zero errors and zero warnings.
   - Open a pull request into `staging` titled `RSOS-<id>: <title>`.
   - Wait for CI. If it fails, fix and push until it is green.
   - Squash-merge into `staging` yourself once CI is green.
   - Never push or merge to `main`. Production promotion is done by the owner later.
3. Do not stop to ask questions after Step 0. If something needs the owner (a payment, a login, a secret value, a DNS change, a business decision):
   - do every other part of the ticket you can,
   - record it under BLOCKERS in the run report with exact steps the owner must take,
   - move on to the next ticket.
4. Secrets: never print, log, commit or ask for secret values in chat. Generate passwords with `openssl rand -base64 32` and pipe them straight into `gh secret set` or `vercel env add`. Never echo them.
5. Cloud only: no Docker, no local Supabase, nothing that only works on this Mac. Databases are Supabase cloud; apps run on Vercel.
6. Multi-market and rename-ready rules from CLAUDE.md always apply: no hardcoded brand, domain, phone or city outside `packages/config` and environment variables.
7. Keep the Mac awake for the whole run: start `caffeinate -dims &` at the beginning and stop it at the end.
8. Keep a run report at `docs/reports/batch-1.md`, updated after every ticket: status, pull request link, pass or fail for each acceptance criterion, and blockers. Commit it with each ticket's pull request.
9. Stop when all tickets are done or after about 3 hours, whichever comes first. Finish the ticket in progress cleanly before stopping.

---

## Step 0: setup that needs the owner (do this first, then run without stopping)

1. Make `gh` work directly: if `gh` is not on PATH, add `~/.local/bin` to PATH in `~/.zshrc`. Confirm `gh auth status` shows `mtalha77` with repo and workflow access.
2. Install the Supabase CLI and the Vercel CLI if missing.
3. Run `supabase login` and `vercel login`. Tell the owner exactly what to click in the browser, and wait until both succeed.
4. Check that the GitHub repository secret `SUPABASE_ACCESS_TOKEN` exists (`gh secret list`). If it is missing, tell the owner: "Create a token at supabase.com, Account, Access Tokens, named github-actions, then add it in GitHub, repository Settings, Secrets and variables, Actions, as SUPABASE_ACCESS_TOKEN." Wait until it exists.
5. Write a 10-line plan covering all tickets below, show it, and start immediately without waiting for approval.

From here on, work without stopping.

---

## Ticket RSOS-004: Supabase cloud projects and migration workflow

Goal: dev, staging and production databases in Supabase cloud, kept identical through migrations in Git. No local database.

Build:

- Use `supabase orgs list` to find the organization (named "Roadside SOS USA" if it exists; otherwise use the only organization and note it in the report).
- Create projects with the CLI in region us-east-1, in this order: `rsos-dev`, `rsos-staging`, `rsos-prod`. For each, generate a password with openssl and pipe it into GitHub secrets `SUPABASE_DB_PASSWORD_DEV`, `SUPABASE_DB_PASSWORD_STAGING`, `SUPABASE_DB_PASSWORD_PROD`. Never print it.
- If the organization's plan does not allow a third project, create dev and staging, record a BLOCKER: "Upgrade the Supabase organization to Pro, then rerun the rsos-prod creation step", and continue.
- Store each project ID as a GitHub Actions variable: `SUPABASE_PROJECT_ID_DEV`, `SUPABASE_PROJECT_ID_STAGING`, `SUPABASE_PROJECT_ID_PROD`.
- Migration enabling extensions: postgis, pgcrypto, citext, pg_cron, pgmq, pg_net.
- Migration creating storage buckets: `provider-documents` (private), `provider-media` (public), `job-photos` (private), `call-recordings` (private).
- Rule in CLAUDE.md: schema changes only through migration files in `supabase/migrations`; never edit any project in the dashboard.
- GitHub Actions:
  - every pull request: apply migrations to `rsos-dev` and run database tests (pgTAP or SQL tests),
  - merge to `staging`: apply migrations to `rsos-staging`,
  - merge to `main`: apply migrations to `rsos-prod`.
  - Replace the RSOS-003 database job that currently skips.
- Type generation from `rsos-dev` into `packages/db`; typed server and browser clients used by all three apps. The service role key is server only.
- Auth URL settings per project: site URL and redirect URLs for the test domain hosts (dev: Vercel preview links; staging: staging, staging-pro, staging-admin; production: apex, www, pro, admin).
- List in the report the production settings the owner must switch on in the dashboard (daily backups, point-in-time recovery before launch).

Acceptance criteria:

1. A sample migration in a pull request is applied to `rsos-dev` automatically, then to staging after merge.
2. Generated types compile and are used by all three apps.
3. Vercel previews use `rsos-dev` and staging and production domains use their own projects (verify after RSOS-005; mark pending until then).

---

## Ticket RSOS-005: Vercel projects, environments and domains

Goal: each app deploys automatically to preview, staging and production addresses on the test domain.

Build:

- Create three Vercel projects linked to the GitHub repo: `rsos-web` (root `apps/web`), `rsos-provider` (root `apps/provider`), `rsos-admin` (root `apps/admin`). Skip builds of apps a commit did not change.
- Use the newest Node version Vercel supports. If it does not support the Node version in `.nvmrc`, set the closest supported version in project settings and `engines`, and note it in the report.
- Production branch `main`. Assign the `staging` branch to the staging domains.
- Domains:
  - `rsos-web`: apex (primary), www (redirect to apex), staging (staging branch)
  - `rsos-provider`: pro, staging-pro (staging branch)
  - `rsos-admin`: admin, staging-admin (staging branch)
- Environment variables per environment (Production, Preview, Development), piped from the Supabase CLI, never printed:
  - Preview and Development use `rsos-dev`; the staging branch uses `rsos-staging`; Production uses `rsos-prod` (if it exists).
  - Site URL variables per app and environment.
  - Validate all variables at build time with Zod.
- Deployment protection on provider and admin previews; website previews public but `noindex`; staging hosts send `noindex`.
- Vercel Analytics and Speed Insights on `rsos-web`.
- If the Vercel account is on the Hobby plan, record a BLOCKER: "Upgrade the Vercel team to Pro (commercial use)", and continue.
- Do not change DNS. Put a table in the report of the exact DNS records Vercel requires for all six hostnames (type, name, value) plus any TXT verification records.

Acceptance criteria:

1. Every pull request gets preview links for the apps it changes.
2. Merging to `staging` updates the three staging hosts (once DNS is added by the owner).
3. All hostnames serve over HTTPS once DNS is live; non-production hosts send `noindex`.

---

## Ticket RSOS-007: Brand and environment config (rename-ready)

RSOS-002 already created `packages/config/src/brand.ts` and an ESLint rule. Check what exists and complete the gaps only.

Build:

- `brand.ts`: name, short name, legal entity name placeholder, support email, social links, logo paths. Site URLs from environment variables.
- Shared metadata helper (titles, descriptions, Open Graph) used by all three apps.
- Placeholder wordmark logo SVG generated from the brand name, plus favicon and app icon set.
- CI check failing if the brand name or test domain appears outside `packages/config` and environment files.

Acceptance criteria:

1. Changing the name in config and the domain variables updates every page title and footer.
2. The CI check catches a hardcoded brand string (prove with a test).

---

## Ticket RSOS-009: Security baseline

Build:

- Security headers on all apps: HSTS, Referrer-Policy, Permissions-Policy (geolocation only on our own pages), frame protection.
- Content Security Policy with nonces, allowing only the services the stack uses (Google Maps, Stripe, Twilio, PostHog, Google Tag Manager, Cloudflare Turnstile, Sentry, Supabase, Vercel).
- Environment variables validated with Zod at startup; the Supabase service role key usable only in server code (add a test or lint rule).
- Helpers ready for later tickets: Cloudflare Turnstile verification and Upstash rate limiting (per IP and per phone). If keys are missing, the helpers must fail safely and a BLOCKER lists the accounts and variable names needed.
- Provider and admin apps never indexed; admin cookies Secure, HttpOnly, SameSite=Lax.
- Dependency audit in CI; `SECURITY.md` covering key rotation and reporting.

Acceptance criteria:

1. Headers present on every route of all three apps (automated test).
2. A form submit without a valid Turnstile token is rejected (unit test with mocked verification).
3. Requests over the rate limit receive 429 (unit test with mocked store).

---

## Ticket RSOS-010: Testing setup

Build:

- Vitest and Testing Library shared config; test data factories for markets, requests and providers.
- Playwright with mobile Safari, mobile Chrome and desktop Chrome projects, running in CI against each pull request's Vercel preview link; axe accessibility helper; a check that fails on any browser console error.
- Storybook for `packages/ui`, built in CI.
- Database tests (pgTAP) for Row Level Security, run against `rsos-dev` in CI.
- If Vercel preview protection blocks Playwright, set up Vercel's protection bypass for automation and store it as a GitHub secret without printing it; if that needs the dashboard, record a BLOCKER with exact steps.

Acceptance criteria:

1. One sample unit, end-to-end, accessibility and database test runs in CI.
2. Storybook builds in CI.

---

## Ticket RSOS-096: QA pipeline and release gates

Goal: broken code cannot reach staging or production.

Build:

- Gate 1 (every pull request, required status checks on `staging` and `main`): lint, typecheck, build with warnings as failures, unit tests with at least 80% coverage on `packages/core` and `packages/db`, migrations and RLS tests on `rsos-dev`, Playwright on the Vercel preview (wait for the deployment to be ready), zero console errors, axe with zero serious or critical issues, Lighthouse budgets on key pages (LCP under 2 s mobile, CLS under 0.05), dependency and secret scans.
- Gate 3: a "Release QA" workflow that runs the full regression suite against staging and opens a checklist issue for manual smoke testing and sign-off.
- Gate 4: production smoke test after each production deployment, with an alert on failure and a documented one-click Vercel rollback.
- Pull request template with the Gate 2 checklist (acceptance criteria, real phone and desktop, light and dark, screenshots); bug issue template with severity; labels critical, high, medium, low.
- `docs/QA.md` explaining each gate and how to read failures.

Acceptance criteria:

1. A pull request with a console error, an accessibility issue or a failing test cannot be merged (prove with a throwaway pull request, then close it).
2. A staging-to-main pull request cannot merge until the Release QA workflow passes.
3. A deliberately failing production smoke test produces an alert (simulate safely; do not touch production data).

---

## Ticket RSOS-097: Team-ready repository and onboarding

Goal: a new developer is productive within one hour using only the docs.

Build:

- README: what the project is, architecture diagram (Mermaid), environments, how to start a Claude Code cloud session on the repo, how to request access.
- CONTRIBUTING: ticket workflow, branch and commit rules, QA gates, review rules, adding a migration, adding a market.
- Onboarding checklist issue template (accounts to request: GitHub, Vercel, Supabase, Sentry, PostHog; access levels; first ticket).
- Decision records in `docs/decisions` with a template and the first records: stack, cloud-only, multi-market, payments model (providers pay a flat fee per picked request from a prepaid wallet; drivers pay providers directly).
- CODEOWNERS by area, ready for when the team grows; environment variables documented per app.
- GitHub Projects board named "RSOS Backlog" with columns Backlog, In progress, In review, Done; add issues for RSOS-001 to RSOS-097 (title only, labels by phase); mark finished tickets as Done.

Acceptance criteria:

1. A fresh reader can follow the README to open a pull request with a passing preview.
2. Every RSOS ticket exists on the board with its ID.

---

## Ticket RSOS-011: Design tokens, typography and motion (only if time remains)

Goal: one source of truth for how everything looks, following "calm under stress".

Build:

- Tailwind preset in `packages/config` with CSS variable tokens for light and dark: deep ink neutral scale, one signal color (safety amber) only for primary action and urgency, status colors (success, warning, critical, info), surfaces, borders.
- Type scale: body 17px mobile and 16px desktop; display sizes for key numbers; tabular numbers for prices, ETAs and money. One clean variable font (Geist or Inter), self-hosted.
- 8-point spacing, radius scale, subtle elevation, focus ring style.
- Motion tokens: 150, 200, 250 ms; standard and emphasized easing; reduced-motion fallbacks.
- Token reference page in Storybook; `DESIGN.md` explaining when to use the signal color.

Acceptance criteria:

1. All color pairs meet WCAG 2.2 AA contrast in both themes (checked by a script in CI).
2. Switching theme changes every surface with no hardcoded colors.
3. Storybook shows the full token set.

---

## End of run: final message to the owner

When you stop, give the owner a short summary in plain language:

1. Tickets finished, with pull request links, and pass or fail per acceptance criterion.
2. BLOCKERS: each one with the exact steps the owner must take, in order.
3. The DNS records table for the test domain from RSOS-005.
4. What to check on the preview and staging links, and the next tickets to run.
