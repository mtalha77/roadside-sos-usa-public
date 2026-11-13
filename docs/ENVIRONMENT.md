# Environment variables

Values live in Vercel (per project and environment) and GitHub (CI). Never commit values: each app has
an `.env.example` with names only. Locally, `vercel env pull apps/<app>/.env.local` (needs Vercel access).
`NEXT_PUBLIC_*` values are sent to the browser, so a secret must never have that prefix.

## All apps (`apps/web`, `apps/provider`, `apps/admin`)

| Variable                                                                   | Secret | Required            | Purpose                                                      |
| -------------------------------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_ENV`                                                     | no     | yes                 | `production`, `staging`, `preview` or `development`          |
| `NEXT_PUBLIC_SITE_URL`                                                     | no     | production, staging | Absolute URL of this app                                     |
| `NEXT_PUBLIC_SUPABASE_URL`                                                 | no     | yes                 | Supabase project URL for this environment                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                     | no     | yes                 | Supabase publishable key (RLS applies)                       |
| `NEXT_PUBLIC_APP_DOMAIN`                                                   | no     | no                  | Overrides the default domain in `packages/config` (rename)   |
| `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_PROVIDER_URL`, `NEXT_PUBLIC_ADMIN_URL` | no     | no                  | Cross-app links per environment                              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                                           | no     | forms               | Cloudflare Turnstile widget                                  |
| `TURNSTILE_SECRET_KEY`                                                     | yes    | forms               | Turnstile server verification (forms fail closed without it) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                       | token  | no                  | Shared rate limits (in-memory fallback without them)         |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                      | no     | no                  | Product analytics (after consent)                            |
| `NEXT_PUBLIC_SENTRY_DSN`                                                   | no     | no                  | Error reporting                                              |
| `SENTRY_AUTH_TOKEN`                                                        | yes    | no                  | Source map upload at build                                   |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                          | no*    | maps                | Google Maps (restrict by HTTP referrer)                      |

\* Browser keys are visible to users; restrict them by referrer and API.

## `apps/provider` only

| Variable                             | Secret | Purpose                  |
| ------------------------------------ | ------ | ------------------------ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no     | Wallet top-ups and plans |
| `STRIPE_SECRET_KEY`                  | yes    | Server-side Stripe calls |
| `STRIPE_WEBHOOK_SECRET`              | yes    | Verifies Stripe webhooks |

## `apps/admin` only

| Variable                                  | Secret | Purpose                                                |
| ----------------------------------------- | ------ | ------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`               | yes    | Back-office work bypassing RLS (`@rsos/db/admin` only) |
| `STRIPE_SECRET_KEY`                       | yes    | Reporting                                              |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | yes    | Phone numbers and SMS                                  |
| `RESEND_API_KEY`                          | yes    | Email                                                  |

## GitHub Actions

| Name                                      | Kind     | Purpose                                                            |
| ----------------------------------------- | -------- | ------------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`                   | secret   | CLI access for migrations and Auth URL config                      |
| `SUPABASE_DB_PASSWORD_{DEV,STAGING,PROD}` | secret   | Database passwords                                                 |
| `VERCEL_AUTOMATION_BYPASS_SECRET`         | secret   | Lets Playwright open protected previews (also a Dependabot secret) |
| `SUPABASE_PROJECT_ID_{DEV,STAGING,PROD}`  | variable | Project refs                                                       |
| `APP_DOMAIN`, `VERCEL_TEAM_SLUG`          | variable | Hostnames for Auth URLs, Release QA and smoke tests                |
