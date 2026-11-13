# Contributing

## Ticket workflow

1. Take a ticket from the "RSOS Backlog" board (move it to **In progress**).
2. Branch from `staging`: `rsos-<id>-<short-slug>` (for example `rsos-024-city-pages`).
3. Build it, with tests. Follow every rule in `CLAUDE.md`.
4. Locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` with zero warnings.
5. Pull request into `staging`, titled `RSOS-<id>: <title>` (move the card to **In review**).
6. Gate 1 checks must pass; tick the Gate 2 checklist in the PR template (`docs/QA.md`).
7. Squash-merge. Check the change on the staging hosts. Move the card to **Done**.

Releases are a pull request from `staging` into `main` (Gate 3, Release QA). Only the owner merges into `main`.

## Commits

Conventional Commits, enforced by commitlint: `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
`refactor:`, `ci:`; lowercase subject, header under 100 characters, ticket ID in the subject
(`feat(web): add city pages (RSOS-024)`).

## Reviews

- One approving review is welcome but not required while the team is one person; when the team
  grows, `CODEOWNERS` maps areas to reviewers and branch protection can require code owner review.
- Reviewers check: acceptance criteria, multi-market rules, RLS and tests for new tables, Zod at
  boundaries, accessibility, no secrets, screenshots for UI changes.

## Adding a migration

1. `pnpm exec supabase migration new <short_name>` creates `supabase/migrations/<timestamp>_<short_name>.sql`.
2. Write the SQL. Every new table: `alter table ... enable row level security;` plus policies in the same file.
3. Add pgTAP tests in `supabase/tests/<nnn>_<name>.test.sql` proving allowed and denied access per role.
4. Open the PR: the `db` job applies it to `rsos-dev` and runs the tests. After the merge,
   `Database deploy` applies it to `rsos-staging`; a release applies it to `rsos-prod`.
5. Regenerate types: `pnpm --filter @rsos/db gen:types`, commit `packages/db/src/database.types.ts`.

Never change the schema in the Supabase dashboard.

## Adding a market

Markets are data, not code. In the admin dashboard (or, until it exists, a reviewed seed migration):
create the market (slug, name, state, time zone, boundary, status `draft`), its phone numbers, enabled
services with price ranges and fees, then set the status to `test` or `active`. Pages, menus and the
sitemap pick it up automatically. Never add a city to code.
