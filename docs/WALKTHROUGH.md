# Staging walkthrough

How to see a full roadside job, from the driver's request to the review, across all three apps on
staging. Everything on staging runs in demo mode: a "Demo data" badge shows in the corner, demo
companies end in "(demo)", and demo phone numbers use the 555-01xx range. Real data (requests from
the Get Help form, markets, prices, provider applications) always wins where it exists.

The fastest way: sign in to the admin (step 3 below), open **Walkthrough** in the sidebar, and press
**Run full demo**. It opens one fresh demo job in the driver's view, the provider portal and the
admin, so you can put the three tabs side by side and watch it play out (about 18 minutes; use
**Demo controls** in the admin sidebar to pause or skip ahead 5 minutes).

The app addresses are the staging URLs set in Vercel (`NEXT_PUBLIC_WEB_URL`,
`NEXT_PUBLIC_PROVIDER_URL`, `NEXT_PUBLIC_ADMIN_URL`); the admin Walkthrough page shows them as links.

## How to sign in as demo

- Provider portal: open the provider sign-in page and choose **Sign in as demo**, then
  **Provider owner** (sees money) or **Provider operator** (sees only assigned jobs).
- Admin: open the admin sign-in page and choose **Sign in as demo**, then **Super admin** or
  **Dispatcher**. The second step is passed for you on the server.
- Driver account (optional): on the website, open `/account` and sign in with any number; the
  code is shown on screen in demo mode.

"Sign in as demo" only exists on staging and preview deployments; production refuses it.

## 1. Driver (website)

1. Home: where a stranded driver lands.
2. City page: local providers, prices and live proof for one market.
3. Get Help (`/get-help`): one question per screen, ending on the request's status page. This
   creates a real request; it appears on the admin dispatch board within 2 seconds.
4. Quotes, pick and tracking (`/r/<token>`): quotes arrive over about 3 minutes, the driver picks
   one, the truck moves on the map, then the job completes and the driver leaves a review.
5. Driver account (`/account`): history, saved vehicles, quick requests.

## 2. Provider (portal)

1. Sign in as demo (Provider owner).
2. Onboarding (`/onboarding`): nine short steps, resumable.
3. Home: Go Online toggle, today's numbers, wallet balance and anything blocking jobs.
4. Incoming offer (`/offer`): send the pre-filled quote in one tap.
5. Active job (`/jobs?tab=active`, open a job, then **Open the job flow**): drive, arrive, work,
   complete, with photos.
6. Wallet (`/wallet`), prices (`/services`), public profile (`/profile`), insights (`/insights`),
   team (`/team`), notifications and help (More menu on phones).

## 3. Admin

1. Sign in as demo (Super admin).
2. Dispatch board (`/dispatch`): lanes, SLA timers, map and supply. Turn on the load test to see
   200 demo requests at once.
3. Request detail (`/requests/<id>`): quotes, timeline, attribution, notes.
4. Phone intake (`/intake`): simulate a call and create a request.
5. Providers, recruitment, markets, pricing, finance, reviews, analytics, content and settings, in
   the sidebar. Press `?` for keyboard shortcuts and Cmd+K (Ctrl+K) to search anywhere.

## What is real and what is demo

The per-screen list is in `docs/reports/batch-3.md`. In short: requests, markets, prices and fees,
provider applications, wallet balances, staff, the audit log and city page intros are real; quotes,
provider activity, finance, reviews and analytics are demo until the backend batch wires matching,
realtime, notifications and payments.
