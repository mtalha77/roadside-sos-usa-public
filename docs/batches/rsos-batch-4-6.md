# RSOS Batch 4.6: platform first, phone second (online booking, Instant book, booking speed)

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy this file into the repo as `docs/batches/rsos-batch-4-6.md` in the first pull request.

**When to run:** after batch 4.5 is finished (or right after its current ticket if it is still running). Build on top of whatever batch 4.5 merged; do not redo its work.

**Prerequisite check:** if `docs/batches/rsos-batch-4-5.md` in the repo does not contain ticket RSOS-107 (automatic ad sync), implement RSOS-107 first from the newest `rsos-batch-4-5-ux.md` in ~/Downloads, then continue here.

Same operating rules as batch 4.5: one branch and pull request per ticket into `staging`, CI green, zero errors and warnings, squash-merge yourself, never touch `main`, no questions, blockers recorded in `docs/reports/batch-4-6.md`, secrets never printed. The UI direction from batch 3 still applies. Attach before and after screenshots (375px and 1440px, light and dark) to every pull request. The stranded person is the **customer** in all copy.

---

## Owner direction (overrides earlier batches where they conflict)

The product is an online booking platform. A customer should get a provider on the way without talking to anyone. The phone is only a backup for people who cannot or will not use the site. Earlier batches leaned toward calls and manual dispatch because of test campaign planning; this batch rebalances the whole product toward online booking.

---

## RSOS-108: Website leads with online booking

- "Get help now" and the service tiles are the primary actions on every page (home, city pages, service pages).
- "Call" becomes a small secondary text link in the top bar and in the sticky mobile bar ("Prefer to call?"), never a large button and never the first thing on a page. Hidden when phones are not enabled.
- Remove any copy that pushes calling as the main path ("Call now for help" and similar). Rewrite to booking-first: "Book help in under a minute".
- City and service pages: the booking start (service tiles or a one-tap "Get help now" with the service pre-selected) appears above the fold.
- Show the speed promise only from real data: "Typical time to book in San Antonio: 4 min" (hide when there is not enough data).

Acceptance: on every public page at 375px, the first primary action is a booking action; calling is visually secondary; screenshots attached.

## RSOS-109: Instant book

On the "Finding help" screen after a request is submitted, the customer chooses between:

1. **Compare quotes** (default): as today, quotes arrive and the customer picks one.
2. **Book the fastest provider automatically:** the customer sets the maximum price they accept (pre-filled with the market's typical price for that service from the price table, adjustable). The first verified, active provider who accepts at or below that price within the quote window is booked automatically.

Rules:

- The customer can switch between the two options at any time before a booking happens.
- Provider side: offers sent under Instant book are marked "Instant book: accept at $X or less". Accepting books the job immediately; the provider sees the booked job screen.
- If no provider accepts within the quote window, fall back to Compare quotes with whatever quotes arrived, then to manual dispatch as the last fallback.
- The fee and number reveal rules from RSOS-038 apply exactly the same way (fee recorded first, then numbers shared).
- Track which option each customer picks and the outcome (booked, fell back, cancelled) for analytics.
- Demo mode: the scenario engine supports Instant book so it can be shown in the walkthrough.

Acceptance: e2e tests for Instant book success, price ceiling respected (a higher quote never books), switching options, and the fallback chain.

## RSOS-110: Admin leads with online bookings

- **Today, Inbox and Dispatch board:** online requests and their booking status come first. Every request carries a small source tag (Website, Call, later App). Calls are not a separate main flow.
- **Manual dispatch is a fallback:** the "Assign provider" action is shown prominently only on requests that have no booking after the quote window, or that were flagged by the customer or a provider. On healthy requests it sits in the "More" menu.
- **Markets go-live checklist:** phone numbers become **optional**. Required: minimum providers per core service, prices set, landing pages live, conversion tracking verified, booking flow tested end to end in that market (a test booking completed and cancelled as "test").
- **Navigation:** "Calls" moves under Operate as the last item; it is hidden entirely when phones are not enabled.
- **Providers page:** show each provider's online status, response rate, median quote time and booking rate (accepted and picked), because these now drive the product.

Acceptance: screenshots of Today, Inbox, Dispatch board and the Markets checklist; a test proves a market can go live with no phone numbers.

## RSOS-111: Booking speed and funnel analytics

- **North-star metrics, per market and source:**
  - Time from landing to request submitted (target under 60 seconds).
  - Time from request submitted to provider booked (target under 5 minutes).
  - Show both on Today (current day and last 7 days, median and 90th percentile) with the target line.
- **Main funnel** in Analytics and Test campaign: visits → started request → submitted → first quote received → booked → completed. Step-by-step conversion and drop-off, per market, source, service and device. Split by Compare quotes vs Instant book.
- **Calls funnel** as a separate, smaller panel: calls → answered → qualified → booked → completed.
- **Where people drop:** per step of the Get Help flow, the share who leave, with the most common last field touched.
- All numbers come from real events only; demo events are excluded from analytics in every environment unless the "Include demo data" toggle is on (staging only).
- Events are recorded server-side where possible, deduplicated, and match the ad conversion events from RSOS-107.

Acceptance: unit tests compute the funnel and timings correctly on seeded events; screenshots of Today metrics and the Analytics funnel.

## RSOS-112: QA pass

- Re-run accessibility (axe), Lighthouse budgets from batch 4.5, e2e and visual checks on staging.
- Update `docs/walkthrough.md` with Instant book and the booking-first flow.
- End-of-run summary: each ticket done, partial or BLOCKED with pull request links, before and after screenshots, measured booking-flow timings on staging, and anything the owner must decide.
