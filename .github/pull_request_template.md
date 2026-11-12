<!-- PR title: RSOS-<id>: <title>    Branch: rsos-<id>-<slug>    Target: staging -->

## Ticket

RSOS-

## What changed

-

## Screenshots

Required for any visible change. Phone is 375px wide, desktop is 1440px.

|         | Light | Dark |
| ------- | ----- | ---- |
| Phone   |       |      |
| Desktop |       |      |

## Definition of done

- [ ] Every acceptance criterion in the ticket is met
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass (and `pnpm build` for app changes)
- [ ] Works on a 375px phone and a 1440px desktop, in light and dark mode
- [ ] No critical accessibility issues; works with keyboard only; touch targets are at least 48px
- [ ] Row Level Security is enabled and tested for every new table (allowed and denied cases per role), or this PR adds no tables
- [ ] No hardcoded brand, domain, phone number or city; market data comes from the database
- [ ] Every new boundary (forms, actions, routes, webhooks, env) is validated with Zod
- [ ] No secrets committed; new environment variables are added to the right `.env.example`
