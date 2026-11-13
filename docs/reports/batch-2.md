# RSOS Batch 2: run report

- Run started: 2026-11-13 16:15 UTC. No time limit (batch rule 13).
- Spec: `docs/batches/rsos-batch-2.md` (part A tickets use `docs/batches/rsos-batch-1.md`, added in RSOS-010 because it was not yet in the repository).
- Repository: `mtalha77/roadside-sos-usa-public` (the batch file names the earlier private repository, which was deleted; see batch 1).
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the first ticket not marked Done.

## Summary

| Ticket   | Status      | Pull request |
| -------- | ----------- | ------------ |
| RSOS-010 | In progress | (this PR)    |

## RSOS-010: Testing setup

- `@rsos/testing`: shared Vitest presets (`vitest/node`, `vitest/react` with jsdom, Testing Library and jest-dom) and deterministic factories for markets, providers and requests (fake 555 numbers, `Test` names).
- `@rsos/e2e` (`tests/e2e`): Playwright projects mobile Safari (iPhone 15), mobile Chrome (Pixel 7) and desktop Chrome (1440x900); automatic console-error guard on every test; axe helper failing on serious or critical WCAG 2.2 AA issues; horizontal-scroll check; light and dark runs.
- CI `e2e` job: waits for the commit's Vercel previews (`scripts/ci/wait-for-previews.sh`), reads each preview URL from GitHub Deployments, runs Playwright. Apps Vercel skipped are skipped in the run.
- Vercel: GitHub Deployments turned on for all three projects; a protection bypass for automation added to `rsos-provider` and `rsos-admin`, value generated with openssl and stored only as the GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET` (never printed).
- CI `storybook` job builds Storybook on every run.
- pgTAP sample RLS test `supabase/tests/002_rls_storage.test.sql` (anon cannot read or upload private storage objects), run against `rsos-dev` by the `db` job.

Acceptance criteria:

| #   | Criterion                                                               | Result            |
| --- | ----------------------------------------------------------------------- | ----------------- |
| 1   | One sample unit, end-to-end, accessibility and database test runs in CI | Pending (this PR) |
| 2   | Storybook builds in CI                                                  | Pending (this PR) |

## BLOCKERS

None yet.

## Notes for the next developer

- The DNS change from batch 1 is live: the apex resolves to Vercel with a valid certificate.
