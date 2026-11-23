# Domain move: fixallcontractors.com → roadrescuesos.com

Started 2026-11-23 with the brand rename to Road Rescue SOS.

## Already in place

- **Vercel:** every roadrescuesos.com host is on its project and verified, with DNS at GoDaddy
  pointing to Vercel:
  - web: `roadrescuesos.com`, `www.` (redirects to the apex), `staging.`;
  - provider: `pro.`, `staging-pro.`;
  - admin: `admin.`, `staging-admin.`.
- **Old domain:** the fixallcontractors.com hosts stay on the same projects, so old links keep
  working.
- **Email:** `EMAIL_FROM` is `Road Rescue SOS <no-reply@mail.roadrescuesos.com>`. The domain is
  verified in the owner's Resend account, the one that issued `RESEND_API_KEY`.
- **Turnstile:** the site key already accepts the new hosts (checked on `staging.roadrescuesos.com`
  on 2026-11-23).

## The switch

1. **Code:** `DEFAULT_DOMAIN` in `packages/config/src/brand.ts` is `roadrescuesos.com`. Links,
   emails, canonical URLs and the production host list follow it. `NEXT_PUBLIC_APP_DOMAIN`
   overrides it if ever needed.
2. **GitHub variables:**
   - `APP_DOMAIN=roadrescuesos.com`;
   - `APP_DOMAIN_ALIASES=fixallcontractors.com`.
     `scripts/supabase-auth-config.sh` sets each Supabase project's site URL to the main domain and
     keeps the alias hosts on the redirect allow list. It runs in `db-deploy.yml` on every merge to
     `staging` and `main`.
3. **Vercel `NEXT_PUBLIC_SITE_URL`:** set it to the new host on each project, for the staging
   branch (staging) and for production (at the release).
4. **Production:** reaches it with the next `staging` → `main` release.

## Later

- Once nothing links to the old domain any more, empty `APP_DOMAIN_ALIASES` and remove the
  fixallcontractors.com hosts, or redirect them to roadrescuesos.com.
- The brand guard keeps blocking both domains outside `packages/config`.
