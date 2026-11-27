# RSOS-118: Move to the final brand and domain (Road Rescue SOS, roadrescuesos.com)

Project repository: github.com/mtalha77/roadside-sos-usa
Copy into the repo as `docs/batches/rsos-domain-move.md`. Run as the next ticket after the current one. Same operating rules as batch 4.6: own branch and pull request into `staging`, CI green, squash-merge yourself, never touch `main` except through the normal release, no questions, secrets never printed.

## Owner decision

- Final domain: **roadrescuesos.com** (bought). Final brand name: **Road Rescue SOS** (from the domain). fixallcontractors.com was only for testing.
- Brand name, domain, support email and phone come only from `packages/config` (already enforced by lint). Change them there; nothing else should hardcode them.

## Domain map

| App              | Production                                                         | Staging                         |
| ---------------- | ------------------------------------------------------------------ | ------------------------------- |
| Customer website | roadrescuesos.com (www redirects to apex)                          | staging.roadrescuesos.com       |
| Provider portal  | pro.roadrescuesos.com                                              | staging-pro.roadrescuesos.com   |
| Admin            | admin.roadrescuesos.com                                            | staging-admin.roadrescuesos.com |
| Email sending    | mail.roadrescuesos.com (Resend, subdomain so the root stays clean) | same                            |

## Work

1. **Config:** brand name "Road Rescue SOS", short name "Road Rescue", domain roadrescuesos.com, support email support@roadrescuesos.com, no-reply sender no-reply@mail.roadrescuesos.com. Update metadata, Open Graph images, favicon text, email templates, legal pages, structured data (Organization, LocalBusiness), sitemap and robots.
2. **Vercel:** add the six domains above to the three projects (production domains to Production, staging domains to the `staging` branch). Report the exact DNS records Vercel asks for in `docs/runbooks/domain.md` and in the end-of-run message, so the owner can add them at the registrar. Do not remove fixallcontractors.com yet.
3. **Redirects:** once roadrescuesos.com is verified, every fixallcontractors.com URL (all subdomains) returns a permanent 301 to the same path on roadrescuesos.com. Keep these redirects for at least 12 months.
4. **Supabase (rsos-dev, rsos-staging, rsos-prod):** update Site URL and allowed redirect URLs for auth to the new domains (keep the old ones until redirects are live, then remove). Update email templates' links.
5. **Everything that stores a URL:** location links, tracking links, webhook URLs (RingCentral when connected, ad platform callbacks), CORS allow-lists, CSP, cookie domains (cookies scoped per app subdomain), Sentry allowed domains, health checks and uptime monitors, `docs/` runbooks including `rsos-setup-for-devs` URLs (Google Maps referrer list must include `roadrescuesos.com/*` and `*.roadrescuesos.com/*`).
6. **SEO:** canonical URLs on the new domain; new sitemap submitted note for the owner (Google Search Console: add a Domain property for roadrescuesos.com and use the Change of Address tool from fixallcontractors.com only if the old domain was ever indexed).
7. **Tests:** update e2e base URLs; a test proves no page renders "fixallcontractors" or "Roadside SOS USA" anywhere (HTML, emails, metadata), except the redirect config.
8. **Repo:** rename references in docs; keep the repository name unless the owner asks.

## Acceptance

- staging.roadrescuesos.com, staging-pro and staging-admin serve the apps with valid HTTPS once DNS is added; old staging URLs 301 to the new ones.
- Sign-in by email code works on the new staging domains (auth redirects correct).
- Brand scan test passes.
- End-of-run message lists the DNS records the owner must add, and confirms what is still pending on DNS.
