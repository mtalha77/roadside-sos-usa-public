# Release train

From the soft launch (v0.1.0, 2026-11-23): **build on `staging` all week, release to `main` every
Monday** once the Release QA checklist passes.

## Every Monday

1. **Release pull request.** At 14:00 UTC the `Release train` workflow opens "Release <week>"
   from `staging` into `main`. It does nothing if one is already open or nothing is new; it can
   also be run by hand.
2. **Release QA.** The `release-qa` check runs the full regression suite and Lighthouse against
   staging, and opens the sign-off issue (`docs/QA.md`, gate 3).
3. **Checklist.** Work through the RSOS-036 checklist (`docs/batches/rsos-batch-4.md`, RSOS-036):
   - CI green on `staging`; staging smoke green;
   - security: Supabase advisors show no errors; no secrets in the build;
   - demo mode off in production: `/api/health` reports `"demoMode": false`;
   - migrations applied; no demo rows in production;
   - production keys present;
   - monitoring: the `Uptime` workflow is green;
   - rollback plan: note the current production deployment ids.
4. **Merge** only if every item passes; otherwise the release waits a week, or a fix lands first.
5. **After merging:**
   - `db-deploy` applies migrations to `rsos-prod`;
   - check that roadrescuesos.com, `pro.` and `admin.` report the new commit in `/api/health`;
   - watch the Vercel runtime logs for 15 minutes with no errors;
   - tag the release (`v0.<n>.0`).

Urgent fixes may skip the train: same checklist, then merge.

## Unfinished work stays behind flags

`packages/config/src/features.ts` lists every flag. Each flag is on outside production and off in
production unless named in the production `NEXT_PUBLIC_FEATURES` variable (comma-separated). Turning
one on is a Vercel setting plus a redeploy, never a code change. Demo mode can never be on in
production.
