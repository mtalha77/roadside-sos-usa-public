# RSOS Batch 4.5: UX overhaul (emergency-first website, admin rebuild, roles, guided tours)

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy this file into the repo as `docs/batches/rsos-batch-4-5.md` in the first pull request.

Why this batch: the owner reviewed staging and the product does not yet feel like urgent help. The website reads like a comparison-shopping page, not an emergency service. The admin is a list of links and a board with layout bugs, and roles are unclear. This batch fixes that before the marketplace engine (batch 5).

Same operating rules as batch 4: one branch and pull request per ticket into `staging`, CI green, zero errors and warnings, squash-merge yourself, never touch `main`, no questions, blockers recorded in `docs/reports/batch-4-5.md`, secrets never printed. Re-read the "UI direction: world class, never generic" section of `docs/batches/rsos-batch-3.md`; it still applies. For every ticket, attach before and after screenshots (375px and 1440px, light and dark) to the pull request.

Wording rule for this batch: the person stranded is the **customer** in all UI copy, code names and docs from now on (not "driver"), so it is never confused with the tow truck driver. The provider's truck driver is the **technician**. Rename in code with a migration-safe approach (keep database column names if renaming is risky; change labels, types and copy).

---

## Problems found on staging (fix all of these)

Website (staging.fixallcontractors.com):

1. Above the fold has no phone number and no "use my location"; the only action is a small button. A stranded person wants one big obvious action.
2. Headline "Get quotes from local roadside pros" sounds like shopping, not rescue.
3. Tapping a service tile does not start the request with that service chosen in one tap.
4. The example quote card shows placeholder text ("Arrival time", "Their arrival time appears here", initials "AV"). Remove or fix.
5. No safety line (911) anywhere near the top.
6. On mobile there is no sticky action bar; the user must scroll back up to act.
7. "How it works", price ranges, cities and FAQ push the action down; their order and weight need rethinking for an emergency.

Admin (staging-admin.fixallcontractors.com): 8. Overview page is just a grid of links with keyboard shortcuts. It must be a "right now" command center. 9. 18 items in the left menu, all visible to every role. A dispatcher does not need Finance, Pricing or Content. 10. Dispatch map: pins pile up in the corners, markers overlap, the map has no city context, and it shows all markets at once. 11. Timer shows "No quote 2523:24" (minutes over 42 hours). Timers must read naturally, and stale requests must be flagged. 12. A real request (R-YCXK, Las Vegas) has sat unhandled for about 42 hours on staging next to demo items. Real and demo items are mixed with no filter. 13. "Load test: 200 demo requests" checkbox sits in the main header; it belongs in Demo controls. 14. Inbox, Requests, Dispatch and Phone intake overlap; it is unclear where a dispatcher should work. 15. Roles are not defined anywhere in the admin.

---

## RSOS-100: Emergency-first website home and city pages

Goal: a stranded customer on a phone at night can ask for help in one tap, within 3 seconds of the page loading.

Mobile above the fold (375 x 667, nothing else above these):

- Small top bar: brand name, and a "Call" link with the market's tracking number when phones are enabled (hidden when `PHONE_PROVIDER=fake` in production).
- Headline, 34 to 40px: "Stuck on the road? Help is on the way." Sub line, one sentence: "Tell us where you are. Nearby tow and roadside pros reply with a price and arrival time in about 3 minutes."
- Live availability line from real data only, for the detected or chosen market: "4 providers online near San Antonio now". If there is no real data, hide the line. Never show invented numbers in production.
- The service grid IS the main action: 6 large tiles in 2 columns (Tow, Won't start, Flat tire, Locked out, Out of gas, Stuck or winch-out), each at least 96px tall with a custom icon. Tapping a tile starts the request with that service chosen and immediately asks for location.
- One full-width primary button "Get help now" under the grid (for people who do not know what is wrong).
- Safety line under it, small but clear: "In danger or on a busy highway? Call 911 first."

Sticky mobile bar (appears once the hero scrolls away): two buttons, "Call" (if phones enabled) and "Get help now". Safe-area aware on iPhone.

Below the fold, in this order:

1. Three reassurance facts in one row: "No sign-up", "No membership", "You pay the provider directly".
2. How it works: 3 steps with real product UI images (quote list, tracking screen) rendered from our components with realistic demo data, never placeholder text.
3. Typical prices for the chosen market (from the database), shown as "from $X" per service, with the note that the quote is the final price.
4. Cities we serve.
5. FAQ (short answers).
6. Provider call to action.

Details:

- Detect market from the URL (city pages) or approximate location; show "Change city" as a small link, never a blocking modal.
- Night mode: follow system theme; if no preference, use the dark theme between 7pm and 6am local time.
- Remove the example quote card with placeholder text.
- Copy: short, calm, specific. No hype words (see batch 3 banned list).
- Performance budget on staging, mobile Lighthouse: LCP under 1.8s, total JS before interaction under 120 KB for the home page, CLS under 0.05. No interactive map on this page.
- Accessibility: tiles are buttons with clear names; focus order matches visual order; 48px minimum targets.

Acceptance: from a cold load on a mid-range phone, a tap on "Tow" reaches the location step in under 1 second; screenshots in the pull request; Lighthouse results attached.

## RSOS-101: Get Help flow, faster and calmer

- Maximum 3 screens before submit: (1) what happened (skipped when a tile was tapped), (2) location: ask for GPS immediately with a clear reason, show the pin, allow a typed address and a landmark note, (3) name, phone and vehicle (make and color only; model optional), then submit.
- Progress indicator ("Step 2 of 3"), back button on every step that keeps entered data.
- After submit: a "Finding help" screen with a live countdown ring, "Your request went to 5 providers near you" (real count only), what to do while waiting (hazard lights, stay in the vehicle if on a highway, etc.), and a "Call us" button when phones are enabled.
- Every error message tells the customer what to do next.
- Works one-handed: primary button always in the bottom thumb zone.

Acceptance: e2e test completes the flow in 3 screens; usability check notes in the pull request.

## RSOS-102: Roles and permissions, defined in the admin

Create **Admin > Team & roles**: a page that shows every role, what it can see and do, and who has it. Invite a user by email, assign a role, optionally limit them to some markets, deactivate a user. Every change is written to the audit log.

Staff roles (admin app):

| Role                | Who                             | Can see and do                                                                                                                                                                            |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner (super admin) | The business owner              | Everything, including team and roles, finance, payouts, settings and deleting data. At least one owner must always exist.                                                                 |
| Operations manager  | Runs day-to-day operations      | Everything except changing owners, billing settings and deleting data.                                                                                                                    |
| Dispatcher          | Handles live requests and calls | Inbox, Dispatch, Requests, Calls, read-only Providers (contact info, services, prices, status). Can assign providers and update request status. No finance, pricing, content or settings. |
| Provider success    | Recruits and manages providers  | Recruitment, Providers (edit), Reviews, read-only Markets.                                                                                                                                |
| Finance             | Money                           | Finance, wallet ledger, fees, refunds, exports. Read-only Requests.                                                                                                                       |
| Marketing           | Ads and content                 | Marketing, Test campaign, Analytics, Content, city pages. No customer phone numbers (masked).                                                                                             |
| Viewer              | Investors, auditors             | Read-only dashboards and reports. Customer data masked.                                                                                                                                   |

Provider roles (provider portal):

| Role                       | Who                                      | Can see and do                                                                                                                                      |
| -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider owner             | Owner of the towing or roadside business | Profile, services and prices, wallet and billing, team, all jobs, insights.                                                                         |
| Dispatcher (provider side) | Office staff at the provider             | Receive offers, send quotes, assign jobs to technicians. No wallet or billing changes.                                                              |
| Technician                 | Truck driver going to the customer       | Only jobs assigned to them: navigation, status steps (on the way, arrived, done), photos. Sees the customer's number only for their own active job. |

Rules:

- Permissions are enforced in the database (RLS) and on the server, not only by hiding menu items. Tests per role prove it.
- The left menu, command palette and shortcuts show only what the role can use.
- Each user's role and market scope appear in their profile menu ("Dispatcher · San Antonio, Houston").
- Demo sign-in on staging offers every role above (staff and provider).

Acceptance: a permission matrix test passes for every role; the Team & roles page lists roles with plain-language descriptions; inviting a user works by email.

## RSOS-103: Admin rebuild: command center, navigation, dispatch board

Navigation (grouped, role-filtered, collapsible):

- **Operate:** Today, Inbox, Dispatch board, Requests, Calls
- **Network:** Providers, Recruitment, Reviews
- **Business:** Markets, Pricing, Finance, Marketing, Test campaign, Analytics
- **System:** Content, Team & roles, Settings, System status
  Merge "Phone intake" into Inbox and Calls. Clear purpose for each: **Inbox** = items a human must act on now; **Dispatch board** = live map and lanes; **Requests** = searchable history; **Calls** = call log.

**Today (replaces Overview):**

- Top strip: "Needs action now" count with the oldest waiting time, unanswered calls, requests with no quote after 3 minutes, providers online per market.
- Main list: the 10 most urgent items, each with one primary action (Claim, Call back, Assign).
- Today's numbers per market: requests, fill rate, median time to assign, completed, fees earned. Calm, small, no decorative charts.
- Alerts: stale requests, markets with no providers online, failed webhooks.

**Dispatch board:**

- Market selector defaults to the dispatcher's markets; the map shows one market at a time with city context (major roads, area labels) on the placeholder map, pins placed at their real coordinates, clustering when zoomed out, no overlapping markers.
- Lanes: New, Quoting, Picked, On the way, On site, plus **Needs closing** for anything older than 2 hours without progress.
- Timers: "45s", "12m 30s", then "2h 14m", then "Stale · 2d". Colour turns amber at 3 minutes without a quote and red at 10 minutes.
- Filter: Real / Demo / Both (default Real in all environments; demo items carry a clear Demo tag).
- Move "Load test" into the Demo controls panel.
- Click a card: side panel with full detail and actions; keyboard: J/K to move, Enter to open, A to assign, C to call.

**Clean up staging data:** close or archive stale real test requests older than 24 hours with reason "test cleanup" (logged), so the board is trustworthy.

**Every admin page:** proper empty, loading (skeleton) and error states; tables 36px rows, sticky headers, column sorting, saved filters; side panels instead of new pages.

**Speed:** route changes under 200ms on staging (prefetch, server components, streaming); tables over 100 rows virtualized; admin JS per route under 200 KB. Report measured numbers.

Acceptance: screenshots of Today, Inbox and Dispatch board in both themes; timer formatting unit tested; menu per role matches RSOS-102; measured performance in the pull request.

## RSOS-104: Provider portal polish

- Apply the same role-filtered navigation, empty/loading/error states and timer rules.
- Offer screen: full screen, big price input with suggested price from their price table, ETA chips (15, 30, 45, 60 min), countdown ring, one "Send quote" button.
- Technician view: a simplified mobile layout with only "My jobs" and the active job.

Acceptance: screenshots at 375px for owner, dispatcher and technician roles.

## RSOS-105: Skippable guided tours (admin, provider portal, website demo)

- Use a small, accessible tour library (pinned version) or build our own; spotlight one element at a time with a short title and one sentence, plus Back, Next, **Skip tour** and "Don't show again".
- **Admin:** a role-specific tour on first sign-in (5 to 7 steps): Owner sees Today, Team & roles, Markets, Finance; Dispatcher sees Inbox, claiming a request, the Dispatch board, assigning a provider, calling. Each major page also has a "?" button that starts a short tour of that page.
- **Provider portal:** first sign-in tour per role: going online, receiving an offer, sending a quote, updating job status, wallet (owner only).
- **Website:** never auto-start a tour for customers (they may be in an emergency). Add a "See how it works" link that opens a 30-second, skippable, auto-playing demo of the request flow using demo data, with a "Get help now" button visible throughout.
- Tour progress and "don't show again" are saved per user in the database, so they follow the user across devices. "Take the tour" in the help menu restarts it anytime.
- Tours work in demo mode and real mode, light and dark, and with keyboard and screen readers. Respect reduced motion.
- The existing "Run full demo" stays, and gains a Skip button and a step list so the owner can jump to any step.

Acceptance: e2e tests for start, skip, don't-show-again and restart, per role; screenshots of two tour steps per app.

## RSOS-106: QA pass and walkthrough

- Re-run full accessibility (axe), Lighthouse, e2e and visual checks on staging.
- Update `docs/walkthrough.md` with a 10-minute owner walkthrough: website as a customer, admin as owner and as dispatcher, provider portal as owner and technician, with exact demo sign-in buttons to press.
- End-of-run summary: each ticket done, partial or BLOCKED with pull request links; before and after screenshots; measured performance; anything the owner must decide.
