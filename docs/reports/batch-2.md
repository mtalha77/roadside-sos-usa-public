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

Acceptance criteria:

| #   | Criterion                                                                            | Result                 |
| --- | ------------------------------------------------------------------------------------ | ---------------------- |
| 1   | A PR with a console error, an accessibility issue or a failing test cannot be merged | Pending (throwaway PR) |
| 2   | A staging-to-main PR cannot merge until Release QA passes                            | Pending                |
| 3   | A deliberately failing production smoke test produces an alert                       | Pending (drill)        |

## BLOCKERS

None yet.

## Notes for the next developer

- The DNS change from batch 1 is live: the apex resolves to Vercel with a valid certificate.
