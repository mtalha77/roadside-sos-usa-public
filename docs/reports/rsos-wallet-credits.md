# Wallet credits and service forms: run report

Run started 2026-11-19, after batch 4.6 (`docs/batches/rsos-batch-4-6.md`). Tickets from
`docs/batches/rsos-wallet-credits.md`: RSOS-115 (wallet bonus credits) and RSOS-116 (complete
service forms and back navigation). Same rules as batch 4.6.

**Prerequisite: BLOCKED (RSOS-114).** The file says to run after RSOS-114. No file in Downloads,
the repository or the GitHub issues contains RSOS-114, so there is nothing to build; both tickets
run without it.

## Summary

| Ticket                                           | Status  | Pull request |
| ------------------------------------------------ | ------- | ------------ |
| RSOS-114 (not specified)                         | BLOCKED |              |
| RSOS-115 Wallet bonus credits                    | Merged  | #201         |
| RSOS-116 Complete service forms, back navigation | Merged  | #203         |

## Tickets

### RSOS-115: Wallet bonus credits

- **Two balances, shown separately**: the paid balance (`provider_wallets`, top-ups in batch 6) and
  bonus credit (`bonus_grants`). Every grant, use, expiry, reversal and refund is a `wallet_ledger`
  row (append-only) and an `audit_log` row. No real money moves: job fees are taken from the
  ledger when a dispatcher assigns a provider (the fake billing path from RSOS-035).
- **Spend order**: bonus credit first, the soonest-expiring grant first, then the paid balance (it
  may go below zero until top-ups exist). Credit pays job fees only; a campaign can allow plans
  (owner only, off by default). The rules live in `packages/core/src/wallet.ts`; the database
  functions follow them.
- **Admin > Business > Wallet credits** (`/credits`): the signup bonus per market (amount, expiry
  days, on or off, start and end dates), a manual grant (amount, expiry, reason from the list,
  "Other" needs a note), a bulk campaign (all providers in a market, a service, inactive 30+
  days, or a pasted list of names; amount, expiry, message and a total budget cap) with a preview
  of who receives it and the total before confirming, rule-based bonuses, approval limits, the
  duplicate-business review queue, recent grants with "Remove unused credit" for the owner, and
  the campaign report (granted, used, expired, providers who topped up later, jobs on credit and
  fees over the next 60 days).
- **Signup bonus on approval**: granted when a provider becomes active (verified), never at
  sign-up, once per business. Until now real providers only came from seed rows, so this adds the
  missing steps: approving an application creates the provider (onboarding), and the provider page
  has **Approve provider** and **Pause provider** (`set_provider_status`). Identifiers (business
  phone now; EIN, insurance policy, bank account and device as those fields arrive in batch 6)
  are stored as hashes; a match with another business flags the bonus for review in Wallet
  credits instead of refusing it silently. There is no plan subscription table yet, so "a plan
  active" cannot be checked; approval alone grants the bonus.
- **Controls**: operations managers grant up to 100 USD per grant and 1,000 USD per campaign,
  owners without limit, finance views; the owner edits the limits. The owner removes unused credit
  (used credit stays used). A refunded fee paid with credit returns as credit with its original
  expiry or 14 days, whichever is later (`refund_job_fee`). A daily job (`/api/cron/credits`)
  expires what is left and sends in-app and email reminders 7 days and 1 day before. Credits are
  never shown to customers and never change a customer's price.
- **Rule-based bonuses** (off by default): the milestone bonus works (credit after the Nth
  completed job, within its budget). Referral and reactivation are saved per market but cannot pay
  yet: there is no referral tracking and no online tracking for real providers; the page says so.
- **Accounting**: fees paid with credit stay fee revenue at full value; the credit used is a
  promotion cost. Finance shows outstanding bonus credit (a liability) per market with used and
  expired totals. The Economics model has "Signup bonus per provider" and "New providers per
  month" inputs: promotion credits used and net fee revenue appear in the results, and
  contribution subtracts them.
- **Provider side**: the wallet shows total available, paid balance, bonus credit with its next
  expiry and every ledger line; on approval the provider sees "Welcome. We added 50 USD bonus
  credit to your wallet...". The For providers page and the FAQ answer "What is bonus credit?";
  the provider terms have a bonus credit clause for attorney review (the terms version is not
  bumped until the attorney approves the text). Demo providers see a labelled demo grant.
- Tests: unit (`packages/core/test/wallet.test.ts`: spend order, expiry and reminders, refunds,
  reversal, approval limits, campaign budget cap, duplicate detection, signup bonus only on
  approval, accounting, the Economics model), database (`supabase/tests/034_wallet_credits.test.sql`:
  signup bonus on approval and once per business, duplicate flagged, both balances by role, spend
  order, a won job's fee taken from credit, refund back to credit, limits, campaign cap,
  reversal, expiry, who reads what) and e2e (`wallet-credits.spec.ts`: the owner sets the bonus, a
  website application is approved into a provider that gets the bonus or the duplicate flag, the
  campaign preview, both balances in the provider wallet, finance's outstanding credit). The e2e
  cannot sign in as the newly approved provider (it has no account) and cannot win a real job end
  to end (no real quote marketplace yet), so the fee taken from credit on a won job is proven in
  the database test.

### RSOS-116: Complete request forms per service, and back navigation fix

- **Same three screens, smarter content.** Screen 1: the service (changeable), "Are you in a safe
  place?", "When do you need help?" (Now by default, or a date and time), people with the vehicle,
  then 1 to 4 tap questions for the service, the market's typical price from the database ("Tows
  in your city usually cost ... plus mileage"), and "Add details (optional)": notes for the provider
  (500 characters) and up to 3 photos. Screen 2: GPS first, typed address, landmark, and the tow
  destination. Screen 3: name, mobile number, optional email; make, model, color, optional year and
  plate. Only the questions marked required in the ticket block submit.
- **Every service's questions** from the ticket (Tow, Won't start, Flat tire, Locked out, Out of
  gas, Winch-out) are defined once in `packages/core/src/service-questions.ts`, validated with Zod
  on the server (the browser enforces required chips too) and stored on the request as structured
  JSON with `answers_version` (migration `20261120020000_service_forms.sql`), so questions can
  change later without breaking old requests.
- **Safety banners**: "In a traffic lane" and "Child or pet inside" show a red "Call 911 now" banner
  with a call button and let the customer continue; both mark the request urgent. Two or more flat
  tires, no spare and "not upright" suggest Tow; ditch or off-road suggests winch-out; an electric
  car (won't start or out of charge) explains it needs a tow or mobile charger. The banners and
  follow-ups (police after an accident, the garage height limit, the scheduled time) work without
  JavaScript.
- **Photos**: compressed on the device (1600 px JPEG) before upload when JavaScript runs, stored in
  the private `job-photos` bucket under the visitor's own draft folder; staff of the request's
  market see them in the request panel (signed for 10 minutes).
- **Providers and the admin**: answers become short tags ("Flatbed needed", "Accident", "No spare",
  "Child inside: urgent") on the admin request panel (with every answer, the scheduled time and
  the photos) and on the provider offer screen above the price. Provider offers come from the
  demo scenario (no real quote marketplace yet), so demo requests now carry believable answers.
- **Admin > Business > Services**: per service, hide a question, make it required or optional, or
  reorder it, for one market or (owner) every market; "Are you in a safe place?" is always asked.
  Every change is in the audit log. Question and chip wording is the same in every market and
  edited in the translations (`packages/i18n`), not on this page.
- **Navigation**: one flow route, `/get-help/<service>/<step>`; `/get-help` is the service picker,
  and old links (`?service=`, `?step=`) move to the new URLs. Tiles are plain links (one history
  entry, no redirect chain). Steps are submitted by a small client layer: the next step is pushed,
  a correction on the same step replaces it, the next step is prefetched. Back (the link or the
  phone's gesture) goes to the previous step with the answers kept, and from screen 1 to the exact
  page the customer came from at the same scroll position. Answers survive a refresh and a return
  within 2 hours (a draft on the device, plus the server draft). Switching service keeps location,
  vehicle and contact. After submit, the request page replaces the flow, so Back goes to the
  starting page. Without JavaScript the forms and links still work (plain posts).
- The account's quick repeat request skips screen 1 and asks safety on the last screen. An ad
  landing page asks the address first, then screen 1, then the details.
- Tests: unit (`packages/core/test/service-questions.test.ts`: required and optional, options and
  ranges, follow-ups, effects and banners, tags, market overrides, demo answers; the web step
  order), database (`supabase/tests/035_service_forms.test.sql`: answers once and within 10
  minutes, photos only from the visitor's draft folder, urgent, overrides by role) and e2e
  (`get-help.spec.ts`: each service's required and optional questions, both 911 banners, Back
  from home, a service page and a city page to the same page and scroll, step 3 → Back → Back
  keeps answers, refresh keeps them, Back after submit goes to the start page;
  `service-answers.spec.ts`: a tow's answers in the admin request panel).
