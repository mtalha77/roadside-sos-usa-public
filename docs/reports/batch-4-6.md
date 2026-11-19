# Batch 4.6 run report

Run started 2026-11-18. RSOS-113 (analytics with correct numbers, `docs/batches/rsos-analytics-fix.md`)
ran first, at the owner's request, between batch 4.5 tickets. The batch itself
(`docs/batches/rsos-batch-4-6.md`) started 2026-11-19, after batch 4.5 finished.

**Prerequisite check: BLOCKED (RSOS-107).** The batch asks for RSOS-107 (automatic ad sync) first if
`docs/batches/rsos-batch-4-5.md` does not contain it, from the newest `rsos-batch-4-5-ux.md` in
Downloads. Neither file contains RSOS-107, and no other file in Downloads mentions it, so there is
no specification to build from. The batch continues without it; RSOS-111's "match the ad conversion
events from RSOS-107" is limited to the existing conversion events (RSOS-031).

## Summary

| Ticket                                  | Status    | Pull request |
| --------------------------------------- | --------- | ------------ |
| RSOS-113 Analytics with correct numbers | In review |              |

## Tickets

### RSOS-113: Analytics with correct numbers

- **Economics model** (Admin > Business > Economics model, owners and operations managers):
  per market, a Base and a Strong scenario, stored in `economics_models` with every saved version
  in `economics_model_history` (who and when; append-only). Seeded from the owner's brief. Finance,
  marketing and viewers read it; nobody else does (`supabase/tests/029_economics_model.test.sql`).
- **The model** (`packages/core/src/economics.ts`): clicks, requests, accepted, fee revenue (service
  mix x fee table, 32.50 USD weighted), payment fees (8%), contribution, profit after fixed costs,
  ad cost per accepted request and break-even accepted requests. Results for each market and
  scenario side by side, plus all markets; "Fixed costs shared across markets" spreads one fixed
  amount across the markets shown instead of charging each market.
- **Unit tests reproduce the Expected results table** (all six rows: clicks, requests, accepted,
  fee revenue, contribution, profit, ad cost per accepted), with nothing rounded before display.
- **Funnel math**: Visits, Started, Submitted, Quoted, Picked, Completed. A step can never show
  more than the one before it (capped, with a data warning naming the step); percentages are step
  to step, with the share of visits on hover; quoted, picked and completed count only requests made
  in the range (cohort by request date), which is what made Completed exceed Picked before.
- **Real, Demo and Model never mixed**: Real is the default everywhere; Demo exists only where demo
  mode is on (never production) and every card says "Demo data"; Model shows "Model estimate".
  With fewer than 20 real requests the Real view says "Not enough real data yet" and still shows
  the real numbers.
- **Demo numbers come from the model**: the placeholder economics in `packages/config` are deleted.
  Each market's demo volume is the model's, with a small seeded daily variation (30-day totals
  within 5% of the model, unit tested); Today and Last 7 days are proportional. Demo controls has a
  Base / Strong switch.
- **Sources and channels**: sources are Google Ads, Meta, Microsoft Ads, Organic search, Direct and
  Referral (click ids, then UTM, then referrer; phone requests use the purpose of the number
  called); channels are Website and Phone. Each table adds up to the requests.
- **Cards**: Requests, Accepted, Ad cost per accepted request, Fee revenue, Contribution, Profit
  after fixed costs, each with the model's number for the same range ("Model: 24.29 USD"); green
  only when better than the model, red only when worse, neutral within 2%.
- **Decisions for the owner**:
  - The brief has no rates for Started, Quoted or Completed. Three editable rates (60%, 90%, 90%)
    shape only the Model and Demo funnels, never the money, and are labelled on the page as
    assumptions not in the brief.
  - Subscriptions and fixed costs are not recorded per day yet, so the Real view takes them from
    the model for the range (said on the page).
  - The unit tests call the three markets A, B and C (the repo forbids real city names in tests);
    the inputs are the brief's.

### RSOS-108: Website leads with online booking

- **Booking is the first action everywhere.** The home and city pages already open with the
  service tiles and Get help now (RSOS-100); service pages keep Get help now right under the
  title; city service pages now put Get help now (full width on phones) directly under the title,
  above the summary and the price; landing pages show the booking form first and their sticky bar
  is now "Book help now".
- **Calling is a small backup.** The top bar shows a small text link ("Call" on phones, "Prefer to
  call? (number)" on wider screens); the sticky phone bar is one full-width Get help now with a
  small "Prefer to call?" link under it; the big "Call now" buttons on landing pages and the
  outlined call button on city service pages are gone. All of these appear only when phones are
  enabled and the market has a number.
- **Booking-first copy**: the hero now reads "Book help in under a minute: nearby tow and roadside
  pros send a price and arrival time in about 3 minutes."
- **Speed promise from real data only**: "Typical time to book in {city}: N min" next to the
  availability line on the home and city pages, from `market_booking_speed` (migration
  `20261119030000_booking_speed.sql`): the median minutes from a request being sent to a provider
  being booked, over the last 30 days, real requests only (fictional 555-01xx numbers and
  test-cleanup requests never count). Fewer than 10 bookings: the line is hidden. Today no market
  has 10 real bookings, so it does not show yet. Tested in `supabase/tests/030_booking_speed.test.sql`.
- Test: `booking-first.spec.ts` checks home, city, service, city service and landing pages at
  375 px: a booking link is the first primary action and above the fold, and any call link is
  plain small text.

### RSOS-109: Instant book

- **The customer chooses on the "Finding help" screen**: **Compare quotes** (the default) or **Book
  the fastest provider automatically**, with "Most you'll pay" pre-filled with the market's typical
  price for the service (the middle of its price range in the price table) and adjustable. They can
  switch either way at any time until a provider is booked.
- **The rule** (`packages/core/src/demo/instant.ts`, unit tested): the first quote, in arrival order,
  at or below the ceiling and inside the 3-minute quote window is booked the moment it arrives (or
  the moment the customer switches, if it was already in). A higher quote never books.
- **Fallback chain**: when the window ends with nothing at or below the ceiling, the page switches
  to Compare quotes with whatever arrived ("No provider accepted at $X or less in time"); with no
  quotes at all, our dispatchers take it ("Our dispatchers are finding you a provider").
- **Provider side**: an Instant book offer says "Instant book: accept at $X or less and the job is
  yours", the price box starts at or below that price, and sending at or below it shows the booked
  job at once (no waiting for the customer to choose).
- **Real requests** (dispatched by hand today; there is no real quote marketplace yet): the choice
  and the ceiling are saved through the status link (`set_booking_mode`, migration
  `20261119040000_instant_book.sql`), manual dispatch can never assign above the ceiling (a database
  rule), and each request records its outcome: booked, fell back or cancelled. Every choice is a
  request event, so RSOS-111 can split the funnel by Compare quotes and Instant book.
- **Fees and numbers**: booking through Instant book uses the same pick as choosing a quote, so the
  RSOS-038 order (fee recorded first, then numbers shared) is unchanged.
- **Demo**: about a third of demo customers use Instant book at the market's typical price; the
  scenario engine books them automatically, so it shows on the admin board, in the provider portal
  and in the walkthrough.
- Tests: unit (`packages/core/test/instant-book.test.ts`: success, ceiling, switching, both
  fallbacks, the demo scenario), database (`supabase/tests/031_instant_book.test.sql`: switching by
  link, ceiling enforced on manual dispatch, outcome recorded, no switching after booking) and e2e
  (`instant-book.spec.ts`: automatic booking, a higher quote never books then the quotes are
  compared, switching back stops the booking). The "no quotes at all" fallback is covered by unit
  tests (every demo request gets quotes).

### RSOS-110: Admin leads with online bookings

- **Source tags everywhere**: every card on the Dispatch board, every Inbox item and every urgent
  item on Today carries a small Website or Call tag; Instant book requests also show their ceiling
  ("Instant ≤ $X"). The Inbox sorts urgent first, then online requests, then the longest wait; on
  Today the missed-calls card moves after the others and shows only when phones are enabled.
- **Manual dispatch is the fallback**: in the request side panel, Assign provider is the primary
  action only when the request has no quote after the window (the amber/red timer) or needs
  closing; on healthy requests it sits under "More". There is no customer or provider "flag" on a
  request yet, so "flagged" is not a condition; it can be added when flags exist.
- **Go-live checklist** (migration `20261119050000_online_first_checklist.sql`): phone numbers and
  the 24/7 phone schedule are now optional; a new required item checks that the booking flow was
  tested end to end in that market (a request assigned, then cancelled as "test", in the last 90
  days). Going live checks only the required items; the page labels optional items and explains
  how to run the test booking.
- **Navigation**: Calls stays the last item under Operate and is hidden entirely when phones are
  not enabled (`phonesEnabled`, now shared from `@rsos/config/phones`).
- **Providers page**: online status, response rate, median quote time and booking rate per
  provider (real ones from the last 30 days of dispatch attempts; demo ones from the scenario).
- Tests: database (`supabase/tests/032_go_live_without_phones.test.sql`: a market with every
  required item and no phone numbers goes live; without the test booking it cannot) and e2e
  (`admin-online-first.spec.ts`).
