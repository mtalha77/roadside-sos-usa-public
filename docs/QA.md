# QA gates

Broken code must not reach staging or production. Four gates, in order.

## Gate 1: automated checks on every pull request

Required status checks on `staging` and `main` (branch protection blocks merging until all pass):

| Check        | What it does                                                                                                                                                                                                    | How to read a failure                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `lint`       | ESLint, Prettier, brand check (`scripts/check-brand.ts`), production dependency audit (`pnpm audit`)                                                                                                            | The log names file and line. Audit: upgrade the package named in the advisory.      |
| `typecheck`  | TypeScript strict in every package                                                                                                                                                                              | File and line in the log.                                                           |
| `test`       | Vitest everywhere; `packages/core` and `packages/db` need 80% coverage (lines, branches, functions)                                                                                                             | A coverage failure lists the uncovered lines: add tests.                            |
| `build`      | Builds apps the PR affects; **any build warning fails** (`scripts/ci/assert-no-warnings.sh`)                                                                                                                    | The warning lines are printed above the error.                                      |
| `db`         | Applies migrations to `rsos-dev`, runs pgTAP tests (RLS) in `supabase/tests`                                                                                                                                    | `not ok` lines name the failing assertion.                                          |
| `storybook`  | Builds Storybook for `packages/ui`                                                                                                                                                                              | Usually a broken story import.                                                      |
| `e2e`        | Waits for the Vercel previews, runs Playwright (mobile Safari, mobile Chrome, desktop Chrome): page loads, **zero console errors**, **zero axe serious or critical issues**, no sideways scroll, light and dark | Download the `playwright-report` artifact; each failure has a trace and screenshot. |
| `lighthouse` | Mobile Lighthouse on the website preview: **LCP under 2 s, CLS under 0.05**, accessibility score 0.9+                                                                                                           | Download `lighthouse-report`; open the HTML for the failing audit.                  |
| `scan`       | Dependency review (no new high-severity vulnerable dependencies) and gitleaks secret scan                                                                                                                       | Remove the secret and rotate it (SECURITY.md); or pick a safe dependency version.   |

GitHub secret scanning and push protection also block secrets at push time.

## Gate 2: author review (pull request template)

Before merging, the author ticks the checklist in the PR: acceptance criteria, a real phone and a
desktop, light and dark, keyboard, screenshots. Merge only when every box is ticked.

## Gate 3: Release QA (staging to main)

Releases are pull requests from `staging` into `main`. The **Release QA** workflow
(`.github/workflows/release-qa.yml`, required check `release-qa` on `main`):

1. refuses pull requests into `main` from any branch other than `staging`,
2. runs the full Playwright regression suite against the three staging hosts,
3. runs Lighthouse budgets on the staging website,
4. opens a "Release QA sign-off" issue with the manual smoke checklist.

Merge the release only when `release-qa` is green **and** the sign-off issue is ticked and closed.

## Gate 4: production smoke test and rollback

After every production deployment of the website, **Production smoke**
(`.github/workflows/production-smoke.yml`) loads the live home page and health endpoint. If it
fails, it opens a `critical` issue assigned to the owner (GitHub emails the assignee).

**One-click rollback:** Vercel dashboard → project (`rsos-web`, `rsos-provider` or `rsos-admin`)
→ Deployments → the last good production deployment → menu → **Instant Rollback**. Or from a
terminal: `vercel rollback --scope <team>`. Then fix forward through a normal pull request.

Database changes are not rolled back by Vercel: write a new migration that reverses the change.

**Alert drill:** add the label `simulate-smoke-failure` to any pull request. The smoke test runs
with one deliberate failing check (no data is touched) and opens a `[Drill]` critical issue.
Close the drill issue afterwards.

## Severity labels

`critical` (users blocked or data at risk: fix now), `high` (major feature broken: this week),
`medium` (degraded, workaround exists), `low` (cosmetic).

## Keeping CI fast

- Jobs run in parallel; the slowest path is the Vercel preview build, then Playwright and Lighthouse.
- Vercel installs only each app's own dependencies (`pnpm install --filter=@rsos/<app>...`), which keeps installs and the build cache small.
- Browsers are installed while Vercel builds and cached between runs; Turborepo task results are cached per job, so unchanged packages skip lint, typecheck, tests and builds.
- Playwright runs 4 workers in CI (tests wait on the network, not the CPU).
