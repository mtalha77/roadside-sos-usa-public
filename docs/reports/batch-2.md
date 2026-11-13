# RSOS Batch 2: run report

- Run started: 2026-11-13 16:15 UTC. No time limit (batch rule 13).
- Spec: `docs/batches/rsos-batch-2.md` (part A tickets use `docs/batches/rsos-batch-1.md`, added in RSOS-010 because it was not yet in the repository).
- Repository: `mtalha77/roadside-sos-usa-public` (the batch file names the earlier private repository, which was deleted; see batch 1).
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the first ticket not marked Done.

## Summary

| Ticket   | Status      | Pull request                                                     |
| -------- | ----------- | ---------------------------------------------------------------- |
| RSOS-010 | Done        | [#7](https://github.com/mtalha77/roadside-sos-usa-public/pull/7) |
| RSOS-096 | In progress | (this PR)                                                        |

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

## BLOCKERS

### Permissions

1. **GitHub Projects permission (RSOS-097).** In Terminal run `gh auth refresh -h github.com -s project`, press Enter, approve in the browser, wait for "Authentication complete". Then run `scripts/setup-backlog-board.sh` (or ask Claude to): it creates the "RSOS Backlog" board with Backlog, In progress, In review, Done, adds all 97 issues and moves finished ones to Done.

### Accounts to create

2. **Google Maps Platform (RSOS-013).** Create a Google Cloud project, enable "Maps JavaScript API", create a browser API key restricted by HTTP referrer to the six hostnames and `*.vercel.app` previews of the team. Add it to Vercel as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (all three projects, all environments) and to GitHub Actions as a secret `STORYBOOK_GOOGLE_MAPS_API_KEY` if you want the live map story. Until then maps show a static placeholder.

## Notes for the next developer

- The DNS change from batch 1 is live: the apex resolves to Vercel with a valid certificate.
