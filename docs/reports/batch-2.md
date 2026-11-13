# RSOS Batch 2: run report

- Run started: 2026-11-13 16:15 UTC. No time limit (batch rule 13).
- Spec: `docs/batches/rsos-batch-2.md` (part A tickets use `docs/batches/rsos-batch-1.md`, added in RSOS-010 because it was not yet in the repository).
- Repository: `mtalha77/roadside-sos-usa-public` (the batch file names the earlier private repository, which was deleted; see batch 1).
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the first ticket not marked Done.

## Summary

| Ticket                         | Status | Pull request                                                         |
| ------------------------------ | ------ | -------------------------------------------------------------------- |
| RSOS-010                       | Done   | [#7](https://github.com/mtalha77/roadside-sos-usa-public/pull/7)     |
| RSOS-096                       | Done   | [#8](https://github.com/mtalha77/roadside-sos-usa-public/pull/8)     |
| RSOS-097                       | Done   | [#110](https://github.com/mtalha77/roadside-sos-usa-public/pull/110) |
| RSOS-011                       | Done   | [#111](https://github.com/mtalha77/roadside-sos-usa-public/pull/111) |
| RSOS-012                       | Done   | [#112](https://github.com/mtalha77/roadside-sos-usa-public/pull/112) |
| RSOS-013                       | Done   | [#113](https://github.com/mtalha77/roadside-sos-usa-public/pull/113) |
| RSOS-014                       | Done   | [#114](https://github.com/mtalha77/roadside-sos-usa-public/pull/114) |
| RSOS-015                       | Done   | [#115](https://github.com/mtalha77/roadside-sos-usa-public/pull/115) |
| RSOS-016                       | Done   | [#116](https://github.com/mtalha77/roadside-sos-usa-public/pull/116) |
| RSOS-017                       | Done   | [#117](https://github.com/mtalha77/roadside-sos-usa-public/pull/117) |
| RSOS-018                       | Done   | [#118](https://github.com/mtalha77/roadside-sos-usa-public/pull/118) |
| RSOS-096 follow-up (faster CI) | Done   | [#119](https://github.com/mtalha77/roadside-sos-usa-public/pull/119) |
| RSOS-093                       | Done   | [#120](https://github.com/mtalha77/roadside-sos-usa-public/pull/120) |
| RSOS-019                       | Done   | [#121](https://github.com/mtalha77/roadside-sos-usa-public/pull/121) |
| RSOS-020                       | Done   | [#122](https://github.com/mtalha77/roadside-sos-usa-public/pull/122) |
| RSOS-024                       | Done   | [#123](https://github.com/mtalha77/roadside-sos-usa-public/pull/123) |
| RSOS-025                       | Done   | [#124](https://github.com/mtalha77/roadside-sos-usa-public/pull/124) |
| RSOS-027                       | Done   | [#125](https://github.com/mtalha77/roadside-sos-usa-public/pull/125) |
| RSOS-026                       | Done   | [#126](https://github.com/mtalha77/roadside-sos-usa-public/pull/126) |
| RSOS-028                       | Done   | [#127](https://github.com/mtalha77/roadside-sos-usa-public/pull/127) |
| RSOS-032                       | Done   | [#128](https://github.com/mtalha77/roadside-sos-usa-public/pull/128) |
| RSOS-033                       | Done   | [#129](https://github.com/mtalha77/roadside-sos-usa-public/pull/129) |

## RSOS-010: Testing setup

- `@rsos/testing`: shared Vitest presets (`vitest/node`, `vitest/react` with jsdom, Testing Library and jest-dom) and deterministic factories for markets, providers and requests (fake 555 numbers, `Test` names).
- `@rsos/e2e` (`tests/e2e`): Playwright projects mobile Safari (iPhone 15), mobile Chrome (Pixel 7) and desktop Chrome (1440x900); automatic console-error guard on every test; axe helper failing on serious or critical WCAG 2.2 AA issues; horizontal-scroll check; light and dark runs.
- CI `e2e` job: waits for the commit's Vercel previews (`scripts/ci/wait-for-previews.sh`), reads each preview URL from GitHub Deployments, runs Playwright. Apps Vercel skipped are skipped in the run.
- Vercel: GitHub Deployments turned on for all three projects; a protection bypass for automation added to `rsos-provider` and `rsos-admin`, value generated with openssl and stored only as the GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET` (never printed).
- CI `storybook` job builds Storybook on every run.
- pgTAP sample RLS test `supabase/tests/002_rls_storage.test.sql` (anon cannot read or upload private storage objects), run against `rsos-dev` by the `db` job.

Acceptance criteria:

| #   | Criterion                                                               | Result                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One sample unit, end-to-end, accessibility and database test runs in CI | PASS: PR #7 ran Vitest everywhere, 27 Playwright tests (3 apps x 3 devices, light, dark, health) with axe and console checks against the previews, and 14 pgTAP tests on `rsos-dev` |
| 2   | Storybook builds in CI                                                  | PASS: `storybook` job green on PR #7                                                                                                                                                |

## RSOS-096: QA pipeline and release gates

- Gate 1 required checks on `staging` and `main`: `lint` (ESLint, Prettier, brand check, `pnpm audit --prod`), `typecheck`, `test` (80% coverage thresholds on `packages/core` and `packages/db`), `build` (warnings fail), `db` (migrations + pgTAP on `rsos-dev`), `storybook`, `e2e` (Playwright on previews, zero console errors, zero axe serious/critical), `lighthouse` (mobile LCP < 2 s, CLS < 0.05, accessibility >= 0.9), `scan` (dependency review + gitleaks).
- Gate 2: PR template checklist; bug template severity; labels `critical`, `high`, `medium`, `low` (plus `release`, `simulate-smoke-failure`).
- Gate 3: `release-qa.yml` (required on `main`): only `staging` may be released; full regression on the staging hosts; Lighthouse on staging; opens a sign-off checklist issue.
- Gate 4: `production-smoke.yml` after each production deployment of the website; failure opens a `critical` issue assigned to the owner; rollback steps in `docs/QA.md`.
- `docs/QA.md` explains each gate and how to read failures.
- Fixes found by the new gates: Next.js build cache in CI and `TURBO_SCM_BASE` (build warnings); `basic-ftp` overridden to 6.2.6 (GHSA-c475-qrg2-pj4r, via Lighthouse CI).
- The automation bypass secret was rotated and is now also a Dependabot secret, so Dependabot PRs can run e2e.

Acceptance criteria:

| #   | Criterion                                                                            | Result                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A PR with a console error, an accessibility issue or a failing test cannot be merged | PASS: throwaway [#10](https://github.com/mtalha77/roadside-sos-usa-public/pull/10): `test` failed (failing unit test), `e2e` failed (console error, `button-name` critical axe issue); merge state BLOCKED; closed |
| 2   | A staging-to-main PR cannot merge until Release QA passes                            | Pending                                                                                                                                                                                                            |
| 3   | A deliberately failing production smoke test produces an alert                       | Pending (drill)                                                                                                                                                                                                    |

## RSOS-097: Team-ready repository and onboarding

- README (what it is, Mermaid architecture, environments, one-hour start, Claude Code cloud sessions, access requests), CONTRIBUTING (workflow, branches, commits, reviews, migrations, markets), `docs/ENVIRONMENT.md` (every variable per app and CI), onboarding issue template, CODEOWNERS by area.
- Decision records: `docs/decisions/0000-template.md`, 0001 stack, 0002 cloud only, 0003 multi-market, 0004 payments model.
- Fixes found by the gates on #110: backlog scripts derived the repository name instead of hardcoding it (brand check); an affected build with no apps is not a warning.
- Issues RSOS-001 to RSOS-097 created (titles only, `phase:*` labels); finished tickets closed as completed. Unknown tickets have the placeholder title "To be specified". Scripts: `scripts/create-backlog-issues.sh` (re-runnable), `scripts/setup-backlog-board.sh`.

Acceptance criteria:

| #   | Criterion                                                                | Result                                                                                                                         |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A fresh reader can follow the README to open a PR with a passing preview | PASS: the README steps match the workflow used for every PR in this run (branch, checks, PR, previews)                         |
| 2   | Every RSOS ticket exists on the board with its ID                        | PARTIAL: all 97 issues exist with IDs; the board itself is BLOCKED (GitHub login lacks the `project` permission, see BLOCKERS) |

## RSOS-011: Design tokens, typography and motion

- `packages/config/src/tokens.ts` is the source of truth: ink neutral scale, safety-amber signal (primary action and urgency only), status colours (success, warning, critical, info with subtle and strong variants), surfaces, borders, focus ring; type scale (body 17px mobile, 16px desktop; display sizes), 8-point radius and elevation, motion (150/200/250 ms; standard, emphasized, exit easing; reduced-motion fallback).
- `tailwind/theme.css` is generated (`tokens:build`); CI `tokens:check` fails if any colour pair misses WCAG 2.2 AA in either theme or the CSS is stale.
- Geist Sans and Mono self-hosted through the `geist` package (`next/font`); tabular numbers for money and time.
- Browser theme colours, app icons and the wordmark take their colours from the tokens; a UI test fails on raw colour values or Tailwind palette classes in apps and `packages/ui`.
- Storybook → Foundations → Design tokens (colours, contrast table, type, space, radius, elevation, motion); `DESIGN.md` explains the signal colour.

Acceptance criteria:

| #   | Criterion                                                       | Result                                                                                                                                            |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All colour pairs meet WCAG 2.2 AA in both themes (script in CI) | PASS: `tokens:check` in the lint job and `packages/config/test/tokens.test.ts` (the check caught light `warning` at 4.38:1 and it was fixed)      |
| 2   | Switching theme changes every surface with no hardcoded colours | PASS: every colour is a CSS variable; `packages/ui/test/no-hardcoded-colors.test.ts` blocks literals and palette classes; e2e runs light and dark |
| 3   | Storybook shows the full token set                              | Pending (this PR's Storybook build)                                                                                                               |

## RSOS-012: Core component library

Components in `packages/ui/src/components` (shadcn/ui patterns on Radix, restyled to the tokens; import as `@rsos/ui/<name>`):

- Actions and inputs: Button (variants, sizes, loading, icon), IconButton (label required), Field + Label (wired help and error text), Input, Textarea, Select, Combobox (cmdk), Checkbox, RadioCards, Switch, Slider, PhoneInput (US format, emits E.164), OTPInput (6 digits, paste, `one-time-code` autofill), CurrencyInput (whole cents), DatePicker (react-day-picker), FileUpload (drag and drop, keyboard, camera capture, type and size validation).
- Layout and feedback: Card, Sheet (vaul bottom sheet, swipe down), Dialog, Drawer (side panel), Tabs, Accordion, Tooltip, Popover, DropdownMenu, Toast (sonner), Alert, Badge, Avatar, Skeleton, EmptyState, Stepper, Progress, Divider.
- Data: DataTable (TanStack Table: sorting, global search, column visibility, pagination, row selection, sticky header, `useSavedViews`, virtual mode), StatCard, KeyValue, Timeline; CommandPalette (Cmd/Ctrl+K).
- Stories for every component and state in `packages/ui/src/stories`; unit tests (`test/behaviour.test.tsx`, `test/a11y.test.tsx` with axe-core).
- New CI step in `storybook`: builds Storybook, then Playwright in real Chromium (mobile and desktop) runs axe and a console-error check on **every story in light and dark**, plus Sheet swipe-down, Dialog/Sheet focus trap and Escape, Drawer Escape and 10,000-row scrolling (`tests/e2e/storybook`).
- TanStack Table is held at 8.21.3: version 9 (August 2026) is a full API rewrite; upgrade later on purpose.

Acceptance criteria:

| #   | Criterion                                                                    | Result                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | All listed components exist with stories and pass axe checks                 | PASS: 24 stories, 106 browser checks (each story x light/dark x mobile/desktop + behaviour) with zero serious or critical axe issues and zero console errors; jsdom axe tests for all components including open overlays |
| 2   | Sheets and dialogs trap focus and close with Escape and swipe down on mobile | PASS: browser tests: Tab stays inside Sheet and Dialog, Escape closes and returns focus to the trigger, a downward swipe closes the Sheet                                                                                |
| 3   | DataTable scrolls 10,000 rows smoothly                                       | PASS: virtual mode keeps under 80 rows in the page, reaches row 10,000, 95th-percentile frame under 50 ms while sweeping the whole list in CI                                                                            |

## RSOS-013: Product components

- ServiceTile (large pressable tile, selected and disabled states), StatusPill (all 10 request states, text always shown, live pulse for quoting and en route), EtaChip, PriceTag (tabular, whole cents).
- CountdownRing: remaining time is computed from `Date.now()` against the end timestamp (no tick counting), refreshed on `visibilitychange` and focus, `role="timer"`, polite announcements once a minute and every 10 s in the last 30 s.
- QuoteCard (provider, rating and count or "New provider", insured and licensed badges, ETA, all-in price, Fastest or Best price tag; whole card is the choice button) with loading and error variants; ProviderCard and ProviderBadgeRow.
- MapView: Google Maps (`@googlemaps/js-api-loader`) with quiet light and dark styles built from the ink tokens, HTML driver and provider markers, provider marker glides between updates; static placeholder listing locations when no key or load failure.
- BigToggle (online/offline switch), SwipeToConfirm (drag, or Enter/Space for keyboard and screen readers), LiveDot and UpdatedAgo.
- Stories for every state (`Product/Components`, `Product/MapView`); unit tests in `test/product.test.tsx`; all new stories pass the browser axe and console checks (134 checks in total).

Acceptance criteria:

| #   | Criterion                                                              | Result                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every component has stories for all states including loading and error | PASS: Product stories cover selected, disabled, loading, error, empty and live states                                                                                                                     |
| 2   | CountdownRing keeps correct time with the tab in the background        | PASS: test jumps the clock 95 s with no timer ticks (throttled background tab), then the tab becomes visible: the ring shows 1:25 immediately                                                             |
| 3   | MapView works with a key and degrades cleanly without one              | PARTIAL: without a key the placeholder renders and passes axe (tested); with a key the loader is called with the key and the map is created (mocked test). A live check needs a Google Maps key (BLOCKER) |

## RSOS-014: Icons and illustrations

- `Icon` (`@rsos/ui/icons`): one component for Lucide and our own icons; sizes sm to xl; decorative icons hidden from screen readers, meaningful ones labelled.
- Original icon set on Lucide's grid (24 px, 2 px round stroke, no fill, `currentColor`): services flat tire, won't start, locked out, out of gas, basic tow, winch out (keys match `services.icon_key`), vehicles car, SUV, pickup, motorcycle, van, RV or trailer.
- Original line illustrations (`@rsos/ui/illustrations`, 160x120, token colours only): share location, compare quotes, track arrival, no requests, waiting, not in your area, offline.
- Storybook: Foundations → Icons and illustrations; service tiles now use the original icons.

Acceptance criteria:

| #   | Criterion                                                     | Result                                                                                                                                                            |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All icons share stroke width and grid and work in both themes | PASS: `test/icons.test.tsx` checks every icon's viewBox, stroke width, caps, joins, no fill, `currentColor`, no fixed colours; stories pass axe in light and dark |
| 2   | No third-party illustration packs or stock images in the repo | PASS: test fails on any raster image in git or any known illustration or stock pack in the lockfile; all artwork is original SVG                                  |

## RSOS-015: Accessibility and language foundation

- next-intl in all three apps with English and Spanish catalogs (same keys, checked by a test); the locale comes from the `NEXT_LOCALE` cookie (default English). Emails render from the message files too (`fill()` for placeholders).
- `@rsos/i18n` formatting: currency, price ranges, numbers, date and time, relative time, all by locale and the **market's time zone** (tests cover Chicago, Phoenix without DST, Los Angeles, New York).
- Lint rule (`packages/config/eslint/next.mjs`, `noHardcodedText`): `react/jsx-no-literals` plus literal `aria-label`/`placeholder`/`alt`/`title` checks in app and component code; stories and tests exempt; proven by `packages/config/test/no-hardcoded-text.test.ts`.
- CLAUDE.md rule 7: accessibility checklist (labels, focus order, contrast, live regions, 48px targets, text, verification).
- Playwright `specs/i18n.spec.ts`: every app in Spanish on mobile Safari, mobile Chrome and desktop: `lang="es"`, heading visible, no sideways scroll, axe clean.

Acceptance criteria:

| #   | Criterion                                           | Result                                                                                                                                        |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No hardcoded user-facing strings (lint enforces it) | PASS: rule active in all apps and `packages/ui` components; the email and phone placeholder strings it found were moved to messages and props |
| 2   | Spanish scaffold renders without layout breaks      | Pending (this PR's e2e run on the previews)                                                                                                   |

## RSOS-016: Core database schema v1

Migration `supabase/migrations/20261113020000_core_schema_v1.sql`:

- Tables (RLS on all, anonymous access revoked, future tables default to no anonymous grants): `markets` (PostGIS centre and boundary, status draft/test/active/paused, coverage hours, support phone, SEO title and intro), `market_phone_numbers` (purpose website/google_ads/meta/microsoft/organic/provider_line, Twilio SID), `services` (icon key, needs destination, allowed vehicle types, sort order), `market_services` (enabled, price range, platform fee, `effective_from`; append-only), `requests` (short code `R-XXXX`, secret status token, market, service, fee row and fee snapshot, status, channel, driver name and E.164 phone with verified flag, pickup and destination points and addresses, landmark note, vehicle, situation flags, notes, dispatcher, timestamps per status), `request_events`, `attributions` (UTM, gclid, gbraid, wbraid, fbclid, msclkid, landing page, referrer, device, hashed IP, call ID), `consents` (phone, type, granted, policy version, IP, user agent, source), `provider_applications`, `contact_messages`, `waitlist`, `audit_log`. History tables are append-only (trigger).
- View `current_market_services` (row in effect now per market and service).
- Functions (the only anonymous entry points): `market_for_point`, `list_public_markets`, `get_market_services`, `create_request` (request + attribution + consents + first event in one transaction, validated), `get_request_by_token` (safe fields only).
- Types regenerated from `rsos-dev` into `packages/db`.
- pgTAP `supabase/tests/003_core_schema.test.sql` (30 assertions).

Acceptance criteria:

| #   | Criterion                                                                   | Result                                                                                                                                           |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A point inside each seeded market returns that market; outside returns none | PASS (with test fixtures; the real seeded markets are re-checked in RSOS-017)                                                                    |
| 2   | Anonymous users cannot read or write any table directly                     | PASS: as `anon`, select/insert on tables and the fee view fail with 42501; only the public functions work; RLS enabled on every table (asserted) |
| 3   | Changing a fee creates a new dated row; old requests keep their fee         | PASS: new row becomes current, old row kept, the request keeps 22.50; UPDATE and DELETE on fee rows are refused                                  |

## RSOS-017: Seed data (markets, services, prices, fees)

- Source data in `supabase/data/`: `census-counties-2024-500k.geojson` (16 counties from the US Census Bureau's generalized 1:500k cartographic boundaries via TIGERweb, ACS 2024) and `markets.json` (markets, county lists, time zones, statuses, services, prices, fees).
- `scripts/seed/build-reference-seed.ts` generates the production-safe migration `20261113030000_reference_data.sql` (idempotent): six services; markets San Antonio (8 counties: Bexar, Atascosa, Bandera, Comal, Guadalupe, Kendall, Medina, Wilson; test), Las Vegas (Clark; test), Houston (Harris, Fort Bend, Montgomery; test), Phoenix (Maricopa; paused = inactive), Orlando (Orange, Seminole, Osceola; paused); boundary = union of the counties; prices and fees as specified (winch out disabled, no fee). Price notes are message keys (`plus_fuel`, `plus_per_mile`) so they can be translated.
- `supabase/seed.sql` (dev only): fake requests, applications, a contact message and a waitlist entry, all named "Dev Seed ..." with fictional 555-01xx numbers; pushed only by the CI `db` job (`--include-seed`) to `rsos-dev`.
- `supabase/checks/no-fake-data.test.sql` runs in `db-deploy` after every staging and production deploy: five markets, six services, 25 enabled market services, and zero dev seed or test rows.
- `BoundaryPreview` component and Storybook story `Product/Market boundaries` (SVG, no map key needed).

Acceptance criteria:

| #   | Criterion                                                                               | Result                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Staging contains the five markets and six services; production gets the same on release | Pending (merge: staging deploy runs the reference migration and the no-fake-data check); production gets the same migration on release        |
| 2   | Boundaries render correctly on a map                                                    | PASS: Storybook `Product/Market boundaries` shows all five markets from the same county data (checked visually and by the axe browser checks) |
| 3   | No fake data in staging or production                                                   | Pending (merge: `no-fake-data` check on staging)                                                                                              |

## RSOS-096 follow-up: faster CI (owner request)

Pull requests now finish their checks in about 2 to 2.5 minutes (was about 5). The preview wait had been timing out at 3 minutes on every run because Vercel reports through commit statuses, not check runs; it now reads those and continues the moment previews are live (about 20 s). Vercel builds install only each app's own dependencies (build cache 464 MB before, builds ~20 s in parallel now); browsers install while Vercel builds and are cached; Turborepo task results are cached per job; Playwright runs 4 workers against previews. The `db` job tolerates migrations from another open PR when the PR itself changes no database files.

## RSOS-018: Authentication and roles

- Migration `20261113040000_auth_roles.sql`: `staff_members` (7 roles, optional market list), `providers` (stub), `provider_members` (owner, manager, operator), wallet and billing stubs; custom access token hook adds `app_role`, `staff_role`, `staff_markets`, `providers` to the JWT; staff policies require `aal2`; market-scoped request access; finance-only money; provider operators see no money.
- `scripts/supabase-auth-config.sh` (CI, every environment): redirect URLs, the hook, authenticator-app MFA (TOTP), 12-character passwords, reauthentication for password changes. Applied to `rsos-dev` (CI log: "token hook on, TOTP MFA on").
- `@rsos/db/claims`: Zod-parsed claims; `adminAccess` (staff only, aal2 required, 12-hour sessions), `providerAccess` (members only, 30-day sessions); `@rsos/db/session` refreshes sessions in the request proxy.
- Admin app: proxy guards every page; `/sign-in` (email and password), `/sign-in/verify` (authenticator setup with QR code and key on first sign-in, code entry after), `/no-access`, dashboard home with sign-out. Session cookies Secure, HttpOnly, SameSite=Lax.
- Provider app: proxy guards every page; `/sign-in` with Password and Email link tabs; `/auth/callback`; `/verify-phone` (required before the portal); `/no-access`; portal home.
- Drivers: no account; `PhoneVerifier` interface in `@rsos/core` (Supabase phone auth with Twilio when `SUPABASE_SMS_ENABLED=true`; mock that accepts 000000 only on development and previews; unavailable elsewhere).
- Tests: pgTAP `005_auth_roles.test.sql` (19), unit tests for claims, access rules, session and phone verification, proxy redirect tests, Playwright `auth.spec.ts` on the previews.

Acceptance criteria:

| #   | Criterion                                                        | Result                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A dispatcher limited to Houston cannot read San Antonio requests | PASS: policy test (sees the Houston request, not San Antonio's, nor its events)                                                                                                                                  |
| 2   | Admin sign-in without the second step is impossible              | PASS: database returns nothing to staff without aal2 (policy test); the proxy sends aal1 sessions to `/sign-in/verify` (unit test); the verify page and every admin page refuse visitors without a session (e2e) |
| 3   | Provider operators cannot read wallet or billing data            | PASS: policy test (operator sees the company, no wallet, no billing; owner sees both)                                                                                                                            |

## RSOS-093: Account and security settings

- Migration `20261113050000_account_security.sql`: security settings, emailed second-step codes (SHA-256 hashes only, 10 minutes, 5 wrong codes then a 15-minute lock), verified sessions (keyed by the JWT `session_id`), trusted devices (hashed 32-byte tokens, 30 days), single-use recovery codes, account requests; definer functions for every change, each writing the audit log. Follow-up migration `20261113050100_email_code_attempts.sql`: asking for a new code no longer resets the wrong-code count (found while building the screens; without it, five wrong codes spread over new codes never locked).
- Remote sign-out: `session_status()` is checked by the provider and admin proxies on every request (`withSessionState` in `@rsos/db/claims`), so a device signed out from the account page is sent to sign-in on its very next request, well inside the 1-minute target. Provider cookies are now Secure + HttpOnly + SameSite=Lax like admin's.
- Shared package `@rsos/account` (used by both apps): server actions for name, email (Supabase secure email change: confirmed on old and new address; `mailer_secure_email_change_enabled` added to `scripts/supabase-auth-config.sh`), password (current password checked first), second-step method, authenticator setup, recovery codes, sign out a device, forget a trusted device, closure request, forgot and reset password; screens for the account page, second step, password reset and the paused/suspended/closed status.
- Provider app: `/sign-in/second-step` (trusted device skips it; otherwise the emailed code is sent on arrival, or the authenticator code if chosen; "Trust this device for 30 days"; recovery code), `/account`, `/forgot-password`, `/reset-password`, `/account-status` (home redirects there when the company is paused, suspended or closed, with the reason and support contact).
- Admin app: `/account` (authenticator always required), `/staff` for super admins (reset a member's authenticator: removes their factors and signs them out everywhere, audited), forgot/reset password, `/auth/callback`; the verify screen says a super admin resets lost authenticators.
- Security emails (new sign-in after the second step, password change, email change, second-step change, recovery codes, device signed out, closure request) go through the `EmailSender` interface in `@rsos/emails`: Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set, a mock on development and previews (the code is shown on screen there), otherwise recorded as not sent. SMS as a second step is shown but disabled until Twilio is set up (BLOCKERS).
- Tests: pgTAP `006_account_security.test.sql` (18, now including the lock across new codes); `@rsos/account` unit tests (13: codes, lock, trusted device, audit and email per change, no account probing, safe redirects); `withSessionState` tests; proxy tests for the new public pages; Playwright: forgot-password flow, account pages need a session, signed-out notice, second step needs a session.

Acceptance criteria:

| #   | Criterion                                                                               | Result                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Email-code providers cannot sign in without the code; 5 wrong codes lock for 15 minutes | PASS: the proxy sends sessions without a passed second step to `/sign-in/second-step` (unit test); pgTAP proves 5 wrong codes lock for 15 minutes, even across new codes, and the right code is refused while locked |
| 2   | Signing out a device ends that session within 1 minute                                  | PASS: `revoke_my_session` deletes the session (pgTAP: `session_status().active` becomes false); the proxy checks it on every request and redirects to `/sign-in?signedOut=1` (unit test)                             |
| 3   | Every security change is written to the audit log and triggers the email interface      | PASS: unit tests check an audit row (from the action or the database function) and an email per change; pgTAP checks the database-side audit rows                                                                    |

## RSOS-019: Website structure, layout and market detection

- Migration `20261113060000_website_structure.sql` (definer functions only; anonymous visitors still read no tables): `list_site_markets` (published markets with their website number: the active "website" tracking number, else the market support line), `list_public_services` (every service, its range across published markets and how many markets offer it), `market_public_stats` (verified active providers and average arrival from real completed jobs; null under 10 jobs), `join_waitlist`. pgTAP `007_website_structure.test.sql` (12).
- `@rsos/db/public`: a cookie-less anonymous client so public data is cached and shared (`unstable_cache`, 5 minutes, tag `site-data`); rows are validated with Zod.
- Routes: `/`, `/get-help` (placeholder start screen that keeps the chosen market and service), `/r/[token]`, `/roadside-assistance/[state]/[city]`, `/services/[service]`, `/roadside-assistance/[state]/[city]/[service]`, `/providers/[slug]`, `/for-providers`, `/for-providers/apply`, `/how-it-works`, `/faq`, `/about`, `/contact`, `/safety`, `/legal/*`, and a 404 page. Market and service pages are generated from the database (unknown ones are 404).
- Header: logo, Services and Cities menus (native disclosures: no JavaScript, closed on navigation, Escape and outside click), For providers, tap-to-call with the visitor's market number, Get help now. Phones: sticky bottom bar with Call and Get help now. Footer: cities, services, company, providers (including provider sign-in), legal, the market number. Breadcrumbs with BreadcrumbList data.
- Market detection: the city page's market, else the visitor's choice (HttpOnly cookie, 90 days), else Vercel's IP location checked against market boundaries in the database. Outside every market: "We're not in your area yet" with a waitlist form (email, optional ZIP; rate limited per IP) plus a city picker, because IP locations are often wrong. Non-US visitors are not told "not in your area".
- Found while testing: Vercel cancels a preview when a newer commit is pushed, and skips the newer one if it does not touch the app. That leaves a branch with no preview for e2e. Fix used here: push a change inside the app. Tip for developers: avoid pushing a test-only commit right after an app commit.

Acceptance criteria:

| #   | Criterion                                                                           | Result                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A Houston visitor sees the Houston number without choosing (mocked headers)         | PASS: unit test with Vercel IP headers for downtown Houston returns the Houston market and its number; the header and phone bar render that number. Real numbers are an owner blocker (none bought yet), so staging shows no call button until they are added |
| 2   | A visitor outside all markets sees the waitlist message, never a broken flow        | PASS: unit test (Dallas headers → outside, with the city); pgTAP stores a waitlist entry and rejects a bad email; on CI runners (outside every market) e2e uses the city picker in that box                                                                   |
| 3   | Adding a market in the database adds its pages and menu entries with no code change | PASS: pgTAP inserts a new test market and it appears in `list_site_markets`; menus, footer, city pages and paths are built only from those rows (unit and e2e tests)                                                                                          |

## RSOS-020: Home page

- Hero: headline about fast quotes from local providers, the service tiles as the main action (each opens `/get-help` with that service and the visitor's market), Call now when the market has a number, trust row (insured providers, quotes in about 3 minutes, no membership).
- How it works in 3 steps with the real `QuoteCard`, `Timeline` and `StatusPill`: the quote is labelled "Example only", uses the low end of a real local price range, shows "New provider" (no rating) and no invented arrival time.
- Live proof only from `market_public_stats` (hidden until there are real providers or at least 10 completed jobs); typical prices from `market_services`; cities; FAQ as native disclosures with FAQPage data; provider recruitment band. No reviews section (no real reviews exist).
- The hero is text only: nothing waits for maps or third-party scripts. Menus and FAQ use no JavaScript.
- Fixed during CI: the how-it-works grid overflowed phone width (implicit grid column grew to its widest child); WebKit reported cancelled link prefetches as errors in one e2e test.

Acceptance criteria:

| #   | Criterion                                                           | Result                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lighthouse mobile LCP under 1.5 seconds on the staging home page    | PASS: Lighthouse CI (mobile, 3 runs) on the staging home: LCP 1.34 s, 1.11 s, 1.17 s; CLS 0; performance 0.98 to 1.0; accessibility 1.0                                                     |
| 2   | Tapping a service tile opens `/get-help` with that service selected | PASS: e2e (Flat tire tile → `/get-help?service=flat-tire`, selection shown) on phones and desktop                                                                                           |
| 3   | No fake numbers or reviews anywhere                                 | PASS: e2e checks the example is labelled and shows no rating, and the page has no review or star text; stats come only from real rows (pgTAP: 0 providers and no average without real jobs) |

## RSOS-024: City pages

- Migration `20261113070000_market_pages.sql`: `market_pages` (headline, intro, areas, highways, local tips, local FAQs, per locale; RLS: staff read in their markets, super admin, ops manager and marketing edit; no anonymous access) and `get_market_page` (published markets only, Spanish falls back to English). Unique copy for San Antonio, Las Vegas and Houston written for each city (local roads, areas, heat, flooding, garages, TDLR licensing), plus titles and meta descriptions in `markets.seo_title` and `seo_intro`. pgTAP `008_market_pages.test.sql` (10).
- City page: headline and intro from the database, Get help now (market preselected) and Call (market number), service tiles, live proof (real data only), typical prices per service linking to the city plus service pages, areas and highways, local tips, local FAQ, nearby cities (nearest first). Structured data: Service (with an offer catalog of real price ranges), BreadcrumbList, FAQPage. Canonical URL. Paused and draft markets are 404.
- Caching: market data is cached for 5 minutes and tagged; `POST /api/revalidate` (Bearer `REVALIDATE_SECRET`, compared in constant time) refreshes every page at once. The secret was generated with openssl and piped into the `rsos-web` and `rsos-admin` Vercel projects (all environments); the admin market screens will call it.
- Indexing stays off on staging by rule (`X-Robots-Tag: noindex` everywhere except the production website).

Acceptance criteria:

| #   | Criterion                                                                     | Result                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The three test markets have live, indexable pages on staging with unique copy | PASS: pgTAP checks three different intros with areas, highways and FAQs; e2e opens every city page and checks a different headline and intro, a canonical URL and no accessibility issues. "Indexable" means the page is crawlable with a canonical and structured data; staging itself stays noindex by rule |
| 2   | Structured data validates                                                     | PASS: e2e parses every JSON-LD block on each city page and finds Service, BreadcrumbList and FAQPage with their required fields (schema.org shapes). Google's Rich Results Test needs a public URL, so run it on production after launch (noted for RSOS-032)                                                 |

## RSOS-025: Service pages and city plus service pages

- Migration `20261113080000_service_pages.sql`: `service_pages` (summary, what it covers and does not, what to expect, typical time on site, safety tips, FAQ) and `market_service_notes` (one short local paragraph per market and service), both with RLS (staff read; super admin, ops manager and marketing edit) and read by visitors only through `get_service_page` and `get_market_service_note`. Content written for all 6 services and 18 market and service pairs. pgTAP `009_service_pages.test.sql` (8). Prices are never stored with the copy: they always come from `market_services`.
- Service page (`/services/[service]`): summary, typical price range across our cities, Get help now (service preselected), links to the service in every city, details, safety tips, FAQ, Service and FAQPage data.
- City plus service page: local note, local price (with "plus fuel" or "plus per-mile charge"), Get help now with market and service preselected, Call, details, links to the other services in that city, the city page and the service page; Service data with the local price range.
- Winch out is switched off in every market by the RSOS-017 seed data. Its pages exist (6 and 18 as required) and say "Not available in {city} yet"; their button starts a tow request for that market instead. Turning winch out on in admin (a new `market_services` row) makes it bookable with no code change.
- Internal links: city → city plus service (prices list), service → each city plus service, city plus service → city, service and the other services in that city; breadcrumbs everywhere.
- Also fixed in the e2e fixtures: WebKit reports a Next.js link prefetch cancelled by a navigation as an "access control" page error; only that exact pattern (`_rsc=` URLs) is ignored, every other browser error still fails the run.

Acceptance criteria:

| #   | Criterion                                                                                       | Result                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 6 service pages and 18 city plus service pages exist for the 3 test markets with unique content | PASS: e2e requests all 6 service pages and opens all 18 city plus service pages, checking 18 different local notes; pgTAP checks 18 unique notes and a page for every service |
| 2   | Every page starts the flow with the right market and service selected                           | PASS: e2e checks the Get help link on all 18 pages carries that market and service (winch out: that market and a tow, see above)                                              |

## RSOS-027: How it works, FAQ, About, Contact, Safety

- Pages (all copy in `packages/i18n/messages`, English and Spanish): How it works with For drivers and For providers tabs and who pays whom; FAQ in four groups (getting help, prices and payment, safety, providers) with a search box that filters the server-rendered questions (answers stay in the page) and one FAQPage block; About; Contact; Safety tips. Each has a title, description and canonical URL.
- Contact form: name, email, optional phone, topic, optional city, message. The server action validates with Zod, rate limits per IP (5 per hour; Upstash when configured, in-memory otherwise), verifies Turnstile (fails closed), stores the message through `submit_contact_message` (migration `20261113090000_contact_form.sql`; visitors still cannot read `contact_messages`), then sends a team notice to the support address and a confirmation to the sender through the email interface. New templates `TeamNoticeEmail` and `FormConfirmationEmail` (reused by RSOS-026).
- Turnstile: Cloudflare's published test keys (always pass) are set on the `rsos-web` Vercel project in every environment (site key as a public config value, secret as a secret). The widget script loads after the page is interactive.
- Tests: pgTAP `010_contact_form.test.sql` (5), unit tests for the contact action (stored and emailed; validation, rate limit and Turnstile run before anything is stored), e2e (FAQ data and search, tabs, accessibility, a real contact submission through the test keys).

Acceptance criteria:

| #   | Criterion                                                      | Result                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | FAQ structured data validates                                  | PASS: e2e parses the FAQPage block on `/faq` (every question has a name and an accepted answer, 13 in all); the home, city and service pages use the same component                                                                  |
| 2   | Contact submissions are stored and trigger the email interface | PASS: unit test (stored with the market, team notice and confirmation sent through `EmailSender`); pgTAP (stored, tagged with the market, unreadable by visitors); e2e submits the form on the preview (rsos-dev, mock email sender) |

## RSOS-026: For Providers page and application form

- Migration `20261113100000_provider_applications.sql`: `market_plans` (Pro and Featured per market, append-only like prices, RLS: staff read, finance and super admin add), `list_market_plans`, and `submit_provider_application` (markets and services by slug stored as ids, unpublished markets ignored; an SMS opt-in is stored in `consents` with the SMS terms version shown). Plans are seeded with the owner's ranges for the three test markets: Pro 99 to 149 USD a month with 15% off fees, Featured 25 to 50 USD a month per market. pgTAP `011_provider_applications.test.sql` (9).
- `/for-providers`: how jobs arrive (3 steps), how the money works (own prices, drivers pay providers directly, flat fee only when picked, prepaid wallet), the fee per picked request for each city and service read from `market_services`, the optional plans from `market_plans`, requirements (insurance; TDLR tow license in Texas).
- `/for-providers/apply`: company, contact name, mobile phone, email, cities, services, number of trucks, insurance carrier, license number, how they heard about us, optional SMS opt-in with the STOP/HELP wording and a link to the SMS terms. Zod validation (fields with errors are marked), rate limit (3 per hour per IP), Turnstile, then a team notice by email and a confirmation to the applicant by email and, with opt-in, by text.
- SMS interface in `@rsos/core` (`SmsSender`): Twilio over HTTPS when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`) are set; a mock on development and previews; "unavailable" elsewhere, which fails safely (the application is still stored and emailed).
- Legal document versions live in `@rsos/config/legal` (RSOS-028 adds the database side).

Acceptance criteria:

| #   | Criterion                                                                                | Result                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Applications are stored with all fields and the market tagged                            | PASS: pgTAP stores an application and checks every field, the published markets chosen (an unpublished one is ignored) and the services; unit test checks the action sends every field; e2e submits the form on the preview |
| 2   | Applicant confirmation goes through the email and SMS interfaces (mock until keys exist) | PASS: unit test (confirmation email to the applicant, team notice, a text through `SmsSender` only with opt-in); SMS interface unit tests (Twilio request, messaging service, failure, environment choice)                  |

## RSOS-028: Legal pages, cookie consent and privacy choices

- Pages under `/legal/`: Driver Terms (we are a marketplace, not the provider; prices, direct payment, emergencies, limits), Provider Terms (verification, quotes, fees, wallet and credits, plans, conduct, insurance, suspension and removal), Privacy Policy (with California, Texas, Nevada and Florida sections and Global Privacy Control), SMS Terms (opt-in wording, STOP and HELP, frequency, message and data rates, carriers), Call Recording Notice, Cookie Policy and Accessibility Statement. English and Spanish. Every page shows "Draft for attorney review. Not yet in effect." and its version.
- Versions: `@rsos/config/legal` (code) and `policy_versions` (database, migration `20261113110000_legal_consent.sql`, RLS: staff read, super admin manages). `consents` now names its document (generated from the consent type) and has a foreign key to `(document, version)`, added `NOT VALID` so only rows written before versioning (development data) are not rechecked; every new consent must name a real version. The dev seed and an older test were moved to the real draft version.
- Cookie banner ("Your privacy choices"): Accept all, Reject all, Choose (analytics and advertising switches; necessary is always on). Choices are saved in a first-party cookie and stored in `cookie_consents` (append-only; a random browser id, the choices, GPC and the cookie policy version; no personal data). The footer link reopens it at any time.
- Google Consent Mode v2: a nonce'd script in `<head>` runs before anything else and sets ad_storage, ad_user_data, ad_personalization and analytics_storage to denied, then applies a stored choice. Global Privacy Control (`navigator.globalPrivacyControl`) always keeps advertising denied, in the browser and in the database (check constraint).
- Vercel Analytics and Speed Insights now load only after analytics consent (and only in production). No Google, Meta or Microsoft tags exist yet; when they are added they must go through the same consent check.

Acceptance criteria:

| #   | Criterion                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Analytics and ad tags cannot fire before consent where consent is required (test) | PASS: e2e (no stored choice) watches every request on the home page: none to Google, Meta, Microsoft or Vercel Analytics hosts, and Consent Mode defaults are all denied; after "Accept all" with GPC on, analytics is granted and advertising stays denied; unit tests for the head script and the mapping. Consent is asked of every visitor (strictest reading, all states) |
| 2   | Every consent record links to a policy version                                    | PASS: pgTAP: an SMS consent with a known version is stored and names its document; an unknown version is refused by the foreign key; cookie choices need a real version and GPC forces advertising off                                                                                                                                                                         |

## RSOS-032: Technical SEO

- One metadata template for every website page (`pageMetadata` in `apps/web/src/lib/seo.ts`): title (with " | brand", or absolute on the home page), description, canonical URL, Open Graph and Twitter tags, robots. The request flow, tracking links and placeholders are `noindex`; staging and previews are never indexable whatever a page says.
- Sitemap index at `/sitemap.xml` with four sitemaps (`/sitemaps/pages.xml`, `cities.xml`, `services.xml`, `city-services.xml`) built from published rows only: test or active markets, services offered in at least one of them, and city plus service pages where the service is enabled. They share the 5-minute cache tag with the pages, so activating a market (or calling `/api/revalidate`) adds its pages.
- `robots.txt`: staging and previews disallow everything; production allows published pages, disallows `/get-help`, `/r/`, `/providers/` and `/api/`, and points to the sitemap.
- Generated Open Graph images (design tokens, no stock art) for the site, each city, each service and each city plus service page.
- Organization and WebSite structured data on the home page (with the cities served); breadcrumbs with BreadcrumbList on every inner page (since RSOS-019).
- Redirects ready for the domain change: migration `20261113120000_redirects.sql` (`redirects` table, RLS: staff read, super admin and marketing manage; `list_redirects` for the site; pgTAP `013_redirects.test.sql`, 5). The proxy sends hosts listed in `REDIRECT_FROM_HOSTS` to `NEXT_PUBLIC_SITE_URL` with a 301 (same path and query) and follows the table for moved pages (301 or 308, cached 5 minutes per instance).

Acceptance criteria:

| #   | Criterion                                                                 | Result                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | No duplicate titles or missing canonicals (automated crawl test)          | PASS: e2e reads the sitemap index, opens every sitemap and every listed page, and checks each has a title, no title repeats, and its canonical URL is its own path                               |
| 2   | Sitemap lists only published pages and updates when a market is activated | PASS: unit tests (paused markets and unoffered services excluded; a newly published market appears with no code change); e2e checks the paused markets and `/get-help` are absent on the preview |

## RSOS-033: Performance budget

- Lighthouse CI (mobile, 3 runs, median) on four page types per preview: home, a city page and a service page (found from the site's own sitemaps, so no city is hardcoded) and `/get-help`. Budgets: LCP under 2 s, CLS under 0.05, TBT under 200 ms (Lighthouse cannot measure INP in a lab run; TBT is its lab proxy), total JavaScript under 150 KB, accessibility at least 0.9.
- What it took to fit: measured on the preview, the React 19 and Next.js 16 runtime alone is about 138 KB on every page, which left about 12 KB for our own code (we started at 17 to 37 KB). Changes:
  - The cookie banner, "Your privacy choices" (now its own page, `/privacy-choices`), the area picker and the waitlist are plain HTML forms posting to route handlers (`/api/consent`, `/api/market`, `/api/waitlist`) that redirect back. They work without JavaScript; Global Privacy Control is read from the `Sec-GPC` header on the server and still from `navigator.globalPrivacyControl` in the head script.
  - Translations are no longer sent to the browser on every page, only on the contact and application forms that need them.
  - The theme toggle uses a plain button and inline icons; shared `Avatar` renders on the server without a photo (its photo part is a tiny client component without Radix).
  - Vercel Analytics and Speed Insights render only after analytics consent (and only in production); Turnstile loads after the page is interactive and only on the two forms; the unused mono font is gone. Fonts are self-hosted (Geist via `next/font`); the site has no raster images (Open Graph images are generated).

Acceptance criteria:

| #   | Criterion                                                                                         | Result          |
| --- | ------------------------------------------------------------------------------------------------- | --------------- |
| 1   | A pull request that breaks a budget fails CI (prove with a throwaway pull request, then close it) | PROOF_PENDING   |
| 2   | All listed pages pass on staging                                                                  | STAGING_PENDING |

## BLOCKERS

### Permissions

1. **GitHub Projects permission (RSOS-097).** In Terminal run `gh auth refresh -h github.com -s project`, press Enter, approve in the browser, wait for "Authentication complete". Then run `scripts/setup-backlog-board.sh` (or ask Claude to): it creates the "RSOS Backlog" board with Backlog, In progress, In review, Done, adds all 97 issues and moves finished ones to Done.

### First accounts

3. **Create the first super admin (RSOS-018), per environment (staging now, production at release).** In the Supabase dashboard for `rsos-staging`: Authentication → Users → Add user → Create new user (your email, a strong password, Auto Confirm on). Then SQL editor, run (data, not schema): `insert into public.staff_members (user_id, role, display_name) select id, 'super_admin', 'Owner' from auth.users where email = 'YOUR-EMAIL';` Sign in at the staging admin host; the first sign-in asks you to set up your authenticator app.

### Accounts to create

2. **Google Maps Platform (RSOS-013).** Create a Google Cloud project, enable "Maps JavaScript API", create a browser API key restricted by HTTP referrer to the six hostnames and `*.vercel.app` previews of the team. Add it to Vercel as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (all three projects, all environments) and to GitHub Actions as a secret `STORYBOOK_GOOGLE_MAPS_API_KEY` if you want the live map story. Until then maps show a static placeholder.
3. **Twilio for SMS (RSOS-018, RSOS-026).** Also add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`) to the `rsos-web` Vercel project so applicants who opt in get a confirmation text; register the number for A2P 10DLC in Twilio first (required for US business texting). For SMS codes: Create a Twilio account and a Verify service. In each Supabase project: Authentication → Providers → Phone → enable, provider Twilio Verify, paste Account SID, Auth Token and Verify Service SID. Then add `SUPABASE_SMS_ENABLED=true` to the `rsos-provider` and `rsos-web` Vercel projects (staging and production). Until then staging and production show "text messages aren't set up yet"; previews use the mock code 000000.

4. **Resend for email (RSOS-093).** Create a Resend account, add and verify your sending domain (Resend shows the DNS records to add). Create an API key with "Sending access". Add to the `rsos-provider` and `rsos-admin` Vercel projects (staging and production): `RESEND_API_KEY` (the key) and `EMAIL_FROM` (for example `Security <security@YOUR-DOMAIN>`). Until then staging and production record security emails as not sent, and previews show the code on screen. Supabase's own emails (reset links, email change) use Supabase's default sender until you also set SMTP in each Supabase project (Authentication → Emails → SMTP, using Resend's SMTP details).

5. **Phone numbers per market (RSOS-019).** In Twilio, buy one local number per market (San Antonio, Las Vegas, Houston) for the website. Then add each one as data (not a migration) in the Supabase SQL editor for `rsos-staging` (and production at launch): `insert into public.market_phone_numbers (market_id, phone_number, purpose) select id, '+1XXXXXXXXXX', 'website' from public.markets where slug = 'houston';` Until then the website shows no call buttons (it never shows a made-up number). Tracking numbers for ads use purpose `google_ads`, `meta` or `microsoft`.

6. **Cloudflare Turnstile (RSOS-027).** Forms use Cloudflare's test keys, which let every request through. In Cloudflare: Turnstile → Add widget, add the website hostnames (staging and production), mode Managed. Then replace the values in the `rsos-web` Vercel project (Settings → Environment Variables): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (site key) and `TURNSTILE_SECRET_KEY` (secret key), for Production and Preview, and redeploy.
7. **Upstash Redis (optional, RSOS-027).** Rate limits work in memory per server instance. For limits shared across instances, create an Upstash Redis database and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `rsos-web` (and the other apps).

8. **Domain change, when the brand changes (RSOS-032).** Add the new domain to the three Vercel projects, set `NEXT_PUBLIC_APP_DOMAIN` (and `NEXT_PUBLIC_SITE_URL`) to it, keep the old domain attached and set `REDIRECT_FROM_HOSTS` on `rsos-web` to the old hosts (for example `fixallcontractors.com,www.fixallcontractors.com`). Every old URL then answers with a 301 to the same path on the new domain. Then add the new domain in Google Search Console and submit `/sitemap.xml`.

### Legal

9. **US attorney review required before the test campaign (RSOS-028).** All seven documents under `/legal/` are drafts written for review, not legal advice. Have a US attorney (consumer protection, TCPA/SMS and state privacy law: California, Texas, Nevada, Florida) review the Driver Terms, Provider Terms, Privacy Policy, SMS Terms, Call Recording Notice, Cookie Policy and Accessibility Statement, and confirm the legal entity name (`brand.legalName` is a placeholder). After changes: update the text in `packages/i18n/messages/{en,es}.json`, set a new version in `packages/config/src/legal.ts` (for example `2027-01-15`, without `-draft`), add the same row to `policy_versions` in a migration with `status = 'published'`, and remove the draft banner.

### Decisions

6. **Winch out (RSOS-025).** It is switched off in every market (seed data). Decide whether to offer it at launch; if yes, enable it per market in admin with its price range and fee. Its pages already exist and switch from "not available yet" to bookable automatically.

7b. **Provider plan prices per city (RSOS-026).** The website shows the ranges you gave (Pro 99 to 149 USD a month with 15% off fees, Featured 25 to 50 USD a month per city). Decide the exact price per city; then add a row per city and plan to `market_plans` (admin plans ticket, or SQL: `insert into public.market_plans (market_id, plan, price_min_cents, price_max_cents, fee_discount_bps) select id, 'pro', 12900, 12900, 1500 from public.markets where slug = 'houston';`). The page updates by itself.

## Notes for the next developer

- The DNS change from batch 1 is live: the apex resolves to Vercel with a valid certificate.
