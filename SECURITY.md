# Security policy

## Reporting a vulnerability

Please **do not open a public issue** (this repository is public). Report privately through
GitHub: **Security** tab → **Report a vulnerability** (private vulnerability reporting), or email
the support address in `packages/config/src/brand.ts`. Include steps to reproduce and the
affected URL or file. We aim to acknowledge within 2 business days and to fix critical issues
within 7 days.

## Where secrets live

Secrets are never committed. Only empty `.env.example` files are in the repository.

| Secret                                    | Stored in                                  | Used by                        |
| ----------------------------------------- | ------------------------------------------ | ------------------------------ |
| `SUPABASE_ACCESS_TOKEN`                   | GitHub Actions secret                      | CI migrations, Auth URL config |
| `SUPABASE_DB_PASSWORD_{DEV,STAGING,PROD}` | GitHub Actions secrets                     | CI `supabase link`             |
| `SUPABASE_SERVICE_ROLE_KEY`               | Vercel (sensitive), `rsos-admin` only      | `@rsos/db/admin` (server only) |
| `TURNSTILE_SECRET_KEY`                    | Vercel (sensitive)                         | `verifyTurnstile` (server)     |
| `UPSTASH_REDIS_REST_TOKEN`                | Vercel (sensitive)                         | rate limiting (server)         |
| Stripe, Twilio, Resend, Sentry keys       | Vercel (sensitive), added by their tickets | server code only               |

Rules: never print or log a secret; never prefix a secret with `NEXT_PUBLIC_`; the service role
key is read only by `packages/db/src/admin.ts` (enforced by `packages/db/test/service-role.test.ts`).

## Key rotation

Rotate every key at least once a year, immediately when someone with access leaves, and
immediately if a key may have leaked (pasted in chat, logged, committed, shown on screen).

1. Create the new key at the provider (Supabase, Stripe, Twilio, Cloudflare, Upstash, ...).
2. Update it where it is stored (table above): GitHub Settings → Secrets and variables → Actions,
   or Vercel project → Settings → Environment Variables (every environment that uses it).
3. Redeploy (Vercel) or re-run the workflow (GitHub) and check it works.
4. Revoke the old key at the provider.
5. Database passwords: Supabase project → Database settings → Reset password, then update the
   matching `SUPABASE_DB_PASSWORD_*` secret (`openssl rand -base64 32 | gh secret set NAME`).

## Built-in protections

- Security headers on every route (HSTS, Referrer-Policy, Permissions-Policy, frame and MIME
  protection) and a per-request nonce Content Security Policy that allows only the services we use
  (`packages/config/src/security.ts`).
- Provider and admin apps, staging and previews are never indexed.
- Admin session cookies are Secure, HttpOnly and SameSite=Lax.
- Environment variables are validated with Zod at build time and at server start.
- Forms verify Cloudflare Turnstile (fails closed) and are rate limited per IP and per phone
  (`@rsos/core/security`).
- Row Level Security on every table; schema changes only through reviewed migrations.
- CI: dependency audit of production dependencies, brand check, GitHub secret scanning and
  push protection; Dependabot weekly updates.
