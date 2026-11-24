# Domain: roadrescuesos.com (RSOS-118)

The product is **Road Rescue SOS** on **roadrescuesos.com**. The old test domain
(fixallcontractors.com) only answers with permanent redirects. Brand name, short name, domain and
emails live in `packages/config/src/brand.ts`, nowhere else.

## Hosts

| App              | Production                               | Staging                           |
| ---------------- | ---------------------------------------- | --------------------------------- |
| Customer website | `roadrescuesos.com` (`www.` → apex, 308) | `staging.roadrescuesos.com`       |
| Provider portal  | `pro.roadrescuesos.com`                  | `staging-pro.roadrescuesos.com`   |
| Admin            | `admin.roadrescuesos.com`                | `staging-admin.roadrescuesos.com` |

All seven are on their Vercel projects (production hosts on Production, staging hosts on the
`staging` branch) and **verified** (checked 2026-11-24, none misconfigured).

## DNS records (GoDaddy, nameservers `ns29`/`ns30.domaincontrol.com`)

All present and correct on 2026-11-24; nothing to add for the apps.

| Type  | Name            | Value                                  |
| ----- | --------------- | -------------------------------------- |
| A     | `@`             | `216.150.1.1` and `216.150.16.1`       |
| CNAME | `www`           | `2aa3b310123237e4.vercel-dns-016.com.` |
| CNAME | `pro`           | `2aa3b310123237e4.vercel-dns-016.com.` |
| CNAME | `admin`         | `2aa3b310123237e4.vercel-dns-016.com.` |
| CNAME | `staging`       | `2aa3b310123237e4.vercel-dns-016.com.` |
| CNAME | `staging-pro`   | `2aa3b310123237e4.vercel-dns-016.com.` |
| CNAME | `staging-admin` | `2aa3b310123237e4.vercel-dns-016.com.` |

Vercel also accepts the older values (`76.76.21.21` for the apex, `cname.vercel-dns.com.` for
subdomains); keep whichever is in place.

### Email (Resend)

- The sender in the brand config is `no-reply@mail.roadrescuesos.com`. The address that actually
  sends is the `EMAIL_FROM` variable in Vercel (server only).
- On 2026-11-24, public DNS has Resend records for the **root** domain:
  - `send.roadrescuesos.com`: MX and SPF;
  - `resend._domainkey.roadrescuesos.com`: DKIM.
- It has **none** for `mail.roadrescuesos.com`.
- If the Resend account shows `mail.roadrescuesos.com` as unverified, add the records Resend lists
  for it, which normally are:
  - MX `send.mail` → `feedback-smtp.<region>.amazonses.com` (priority 10);
  - TXT `send.mail` → `v=spf1 include:amazonses.com ~all`;
  - TXT `resend._domainkey.mail` → the DKIM key Resend shows.
- Or set `EMAIL_FROM` to an address on the verified root domain.
- DMARC is already set on the root: `_dmarc`, `p=quarantine`.

## Old domain

- Every URL on the old domain, any subdomain, page or API, returns **301** to the same subdomain,
  path and query on roadrescuesos.com. This is `legacyRedirect()` in
  `packages/config/src/legacy-redirect.ts`, called first by each app's proxy.
- `www.` on the old domain first takes Vercel's own 308 to its apex, then the 301.
- **Keep the old hosts on Vercel and the redirect until at least 2027-11-24.** Then remove them
  from Vercel and from `LEGACY_DOMAINS` in `brand.ts`.
- Supabase Auth: `scripts/supabase-auth-config.sh` sets the site URL to the main domain. While the
  GitHub variable `APP_DOMAIN_ALIASES` lists the old domain, the old hosts stay on the redirect
  allow list.
- Once the redirects are live in production, delete that variable. The next `db-deploy` run then
  removes the old hosts from all three projects.

## Everything else that holds a URL

- **Links between apps, emails, canonical URLs, sitemap, robots, structured data and the
  production host list:** all built from `brand.domain` via `appUrl()`, so nothing to change.
- **Cookies:** host-only, so scoped to each app's own subdomain.
- **CSP:** lists only third-party origins.
- **Uptime workflow:** follows the `APP_DOMAIN` variable.
- **Location and tracking links:** built per request from the current host.
- **Webhooks:**
  - Twilio and RingCentral are not connected;
  - when they are, register `https://roadrescuesos.com/api/...` (see their runbooks);
  - ad platforms have no callbacks.
- **Google Maps browser key referrers** (`docs/runbooks/google-maps.md`): `roadrescuesos.com/*`
  and `*.roadrescuesos.com/*`.
- **Sentry:** not connected. When it is, allow `roadrescuesos.com` and `*.roadrescuesos.com`.

## Search (owner)

- Google Search Console: add a **Domain property** for `roadrescuesos.com` (DNS TXT check), then
  submit `https://roadrescuesos.com/sitemap.xml`.
- Use **Change of Address** from the old domain only if it was ever indexed. It was `noindex` on
  staging and had no public launch, so this is most likely not needed.

## Checks

- `tests/e2e/specs/brand-scan.spec.ts`: no page, sitemap, robots or manifest shows a legacy name
  or domain.
- `packages/emails/test/brand-scan.test.tsx`: no email or message string does either.
- `packages/config/test/legacy-redirect.test.ts`: the 301 mapping.
- `scripts/check-brand.ts` and ESLint block both names and both domains outside
  `packages/config`.
