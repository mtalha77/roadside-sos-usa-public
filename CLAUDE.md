# CLAUDE.md

Guidance for Claude Code and every human working in this repository. Read it before changing anything.

## Product

**Roadside SOS USA** (working name; test domain `fixallcontractors.com`; both will change, see "Brand" below) is a US roadside assistance marketplace.

- A stranded driver shares their location and problem.
- Within **3 minutes** they get quotes with **price and ETA** from nearby **verified providers**, and pick one.
- **Drivers pay providers directly.** We never handle the job payment.
- **Providers pay us** a flat fee per picked request from a **prepaid wallet**, plus optional **Pro** and **Featured** plans.

Three apps:

| App             | Who uses it                                            | Local URL             |
| --------------- | ------------------------------------------------------ | --------------------- |
| `apps/web`      | Drivers and the public (marketing pages, request flow) | http://localhost:3000 |
| `apps/provider` | Providers (quotes, jobs, wallet, plans)                | http://localhost:3001 |
| `apps/admin`    | Our team (markets, verification, pricing, fees)        | http://localhost:3002 |

## Non-negotiable rules

### 1. Multi-market from day one

Every **request, provider, price, fee, phone number and page** belongs to a **market** (a metro area) stored in the database.

- Every market-scoped table has a non-null `market_id` foreign key. Every query filters by market.
- **Launching a city is an admin action in `apps/admin`, never a code change.** No `if (city === ...)`, no city lists, enums or constants in code.
- Market-specific values (fees, plan prices, Twilio numbers, service areas, time zones, page copy) are rows in the database, never code or env vars.

### 2. No hardcoded brand, domain, phone number or city

- Brand name, short name, tagline, domain, URLs and brand emails come only from `packages/config/src/brand.ts`: `import { brand } from "@rsos/config/brand"`.
- ESLint blocks string literals containing the brand name or domain anywhere else (`no-restricted-syntax` in `packages/config/eslint/base.mjs`).
- Phone numbers and cities are market data from the database. Never write one in code, copy, tests or seed files, except clearly fake test values.
- User-facing text goes in `packages/i18n/messages/*.json`, never inline in components.

### 3. Zod validation at every boundary

Validate with Zod (`packages/core` schemas) wherever data enters or leaves trusted code: form input (React Hook Form + `zodResolver`), Server Actions, Route Handlers, Edge Functions, webhooks (Stripe, Twilio, Resend), third-party API responses, environment variables, URL/search params and database rows read through untyped paths. Parse, don't cast: no `as SomeType` on external data.

### 4. Row Level Security on every table

- Every table enables RLS **in the same migration that creates it**, with explicit policies. No table ships without them.
- Default deny. Policies are scoped by role (driver, provider, admin) and by market.
- Every new table gets RLS tests (pgTAP in `supabase/tests/` or integration tests) proving allowed and denied access for each role.

### 5. Never expose the Supabase service role key to the browser

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`, log it, or send it to the client.
- Only `@rsos/db/admin` reads it, and that module imports `server-only`, so the build fails if a Client Component imports it.
- Prefer the user-scoped clients (`@rsos/db` in the browser, `@rsos/db/server` on the server) so RLS applies. Use the admin client only for trusted back-office work, with explicit permission checks.
- No secrets in the repo. Only `.env.example` files (empty values) are committed.

### 6. Mobile-first, dark mode and accessibility

- **Mobile-first:** design for a 375px phone first, then scale up. Stranded drivers are on phones, often in poor light and with bad signal: keep pages light and fast.
- **Dark mode** everywhere: use theme tokens (`bg-background`, `text-foreground`, `bg-primary`, ...), never raw colours. Check both themes.
- **WCAG 2.2 AA:** 4.5:1 text contrast, visible focus, full keyboard use, labelled controls, semantic landmarks and headings, `prefers-reduced-motion` respected.
- **48px touch targets:** everything tappable uses at least `min-h-touch` (and `min-w-touch` for icon buttons). The shared `Button` already does.

## Stack

Turborepo + pnpm workspaces · Next.js (App Router) + TypeScript strict · Tailwind CSS v4 + shadcn/ui (Radix) + Motion · React Hook Form + Zod · TanStack Query and Table · Supabase (Postgres + PostGIS, Auth, Realtime, Storage, Edge Functions) · Vercel · Google Maps Platform · Twilio · Stripe · Resend · Sentry · PostHog · next-intl (English first, Spanish-ready) · Vitest, Playwright, Storybook.

- **Versions are pinned exactly** (`savePrefix: ''` in `pnpm-workspace.yaml`). Upgrade on purpose, never with `^` or `~`.
- Node is pinned in `.nvmrc` (use `fnm use` or `nvm use`). pnpm is pinned in `packageManager`.
- TypeScript is held on 6.0.x because typescript-eslint does not support 7.x yet.
- SDKs for Stripe, Twilio, Resend, Sentry, PostHog, Google Maps, Motion, React Hook Form and TanStack are added in the ticket that first uses them.

## Folder map

```
apps/
  web/         Public website and driver request flow (Next.js, port 3000). Playwright e2e in e2e/.
  provider/    Provider portal (Next.js, port 3001)
  admin/       Admin dashboard (Next.js, port 3002)
packages/
  config/      brand.ts (brand name + domain), Tailwind theme (tailwind/theme.css), ESLint configs, tsconfigs
  ui/          Design system: shadcn/ui components on Radix, theme provider and toggle, Storybook
  db/          Supabase clients (browser, server, admin) and generated database types
  core/        Shared business logic and Zod schemas (markets, money, phone, location)
  emails/      React Email templates
  i18n/        next-intl message catalogs (en.json, es.json; keys must match)
supabase/
  config.toml  Local stack config
  migrations/  SQL migrations (RLS in the same migration as the table)
  seed.sql     Local test data
  functions/   Edge Functions
docs/          Product docs and backlog
```

Workspace packages are imported as `@rsos/<name>` and ship TypeScript source (no build step); each Next app lists them in `transpilePackages`.

## Commands

Run from the repository root.

| Command                            | What it does                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `pnpm install`                     | Install everything                                                        |
| `pnpm dev`                         | Run all three apps (3000, 3001, 3002)                                     |
| `pnpm --filter @rsos/web dev`      | Run one app                                                               |
| `pnpm build`                       | Production build of every app                                             |
| `pnpm lint`                        | ESLint everywhere                                                         |
| `pnpm typecheck`                   | TypeScript everywhere                                                     |
| `pnpm test`                        | Unit tests (Vitest) everywhere                                            |
| `pnpm test:e2e`                    | Playwright (first run: `pnpm --filter @rsos/web exec playwright install`) |
| `pnpm storybook`                   | Storybook for `packages/ui` on port 6006                                  |
| `pnpm email:dev`                   | React Email preview on port 3003                                          |
| `pnpm format`                      | Prettier                                                                  |
| `pnpm exec supabase start`         | Local Supabase (needs Docker Desktop)                                     |
| `pnpm --filter @rsos/db gen:types` | Regenerate database types after a migration                               |

## Git workflow

- Tickets are `RSOS-<id>`.
- **Branch names:** `rsos-<id>-<slug>`, e.g. `rsos-012-provider-wallet`.
- **Pull request titles:** `RSOS-<id>: <title>`, e.g. `RSOS-012: Provider wallet top-up`.
- **Commits** follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` ...), enforced by commitlint in a Husky `commit-msg` hook. The `pre-commit` hook runs lint-staged (ESLint + Prettier on staged files).
- Never commit secrets or `.env` files.

## Definition of done

A ticket is done only when **all** of these are true:

1. Every acceptance criterion in the ticket is met.
2. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass (and `pnpm build` for app changes).
3. It works on a **375px phone** and a **1440px desktop**, in **light and dark mode**.
4. No critical accessibility issues (axe / Storybook a11y panel / Lighthouse), keyboard-only use works.
5. **RLS is tested** for every new table (allowed and denied cases per role).
6. No hardcoded brand, domain, phone number or city, and every new boundary is validated with Zod.
