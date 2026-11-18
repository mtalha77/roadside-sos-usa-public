# RSOS Batch 4.5: run report (UX overhaul)

- Run started: 2026-11-18. Spec: `docs/batches/rsos-batch-4-5.md`. Same operating rules as batch 4.
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the
  first ticket not marked Done.

## Summary

| Ticket                                            | Status      | Pull request                                                         |
| ------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| RSOS-100 Emergency-first website home, city pages | Merged      | [#184](https://github.com/mtalha77/roadside-sos-usa-public/pull/184) |
| RSOS-101 Get Help flow, faster and calmer         | Merged      | [#186](https://github.com/mtalha77/roadside-sos-usa-public/pull/186) |
| RSOS-102 Roles and permissions in the admin       | In review   |                                                                      |
| RSOS-103 Admin rebuild (Today, navigation, board) | Not started |                                                                      |
| RSOS-104 Provider portal polish                   | Not started |                                                                      |
| RSOS-105 Skippable guided tours                   | Not started |                                                                      |
| RSOS-106 QA pass and walkthrough                  | Not started |                                                                      |

## Tickets

### RSOS-100: Emergency-first website home and city pages

- **Above the fold on a 375 x 667 phone**, nothing else:
  - the brand and a small "Call" link with the market's tracking number (only when phones are
    enabled: always outside production, and in production only when Twilio voice is really
    connected);
  - "Stuck on the road? Help is on the way." and one sentence;
  - the real availability line ("N verified providers near {city}") with a "Change city" link,
    hidden without real data;
  - six service tiles in two columns (Tow, Won't start, Flat tire, Locked out, Out of gas, Stuck
    or winch-out), each at least 96px tall, that start the request with that service and land on
    the location step;
  - a full-width "Get help now";
  - "In danger or on a busy highway? Call 911 first."
- **Phone action bar** (Call, Get help now): safe-area aware, hidden while the hero is on screen,
  shown once it scrolls away.
- **Below the fold, in order**: reassurance (no sign-up, no membership, you pay the provider
  directly); how it works with the real quote card and tracking components (a fictional demo
  provider with a realistic arrival time and a real local price; the "Arrival time" placeholder is
  gone); local prices; cities; FAQ; the provider call to action. City pages use the same hero with
  the city's headline.
- **Night mode**: the visitor's saved choice wins; otherwise the system theme; with a light system
  theme the site is dark between 7pm and 6am local time.
- **Less JavaScript**: the theme provider, theme toggle and menu closer were replaced by one small
  inline script (`apps/web/src/lib/site-script.ts`).
- **Demo badge on the website** is now a slim strip at the top of the page: as a fixed corner
  badge it covered the 911 line on phones.
- Tiles show the services enabled in the market (or anywhere, without a market). Winch-out is not
  enabled in any market yet, so five tiles show today; the sixth appears when a market enables it.
- **JavaScript on the home page** (mobile, transferred): 146.9 KB before, about 139 KB after
  (theme provider, toggle and menu closer replaced by an inline script; Vercel Analytics loaded
  only when it is used). The spec's 120 KB target is below what Next.js 16 itself needs: React DOM,
  the router and the runtime are about 137 KB on every page. Reaching 120 KB would mean leaving
  Next.js for the home page, so it is recorded as **partial** for the owner to decide.
- Note: the spec's availability line says "online now". There is no provider presence data yet
  (going online arrives with the provider portal work), so the line shows the real count of
  verified providers serving the market, never invented numbers.

### RSOS-101: Get Help in three screens

- **Three screens, each with one job**, and "Step n of 3" on each:
  1. **What happened?** The service tiles; follow-up questions are optional. Tapping a tile on the
     home page skips this screen.
  2. **Where are you?** The browser asks for the location as soon as the screen opens (one sentence
     says why); the pin, the address, the city and a landmark note; tow requests also ask where the
     car should go.
  3. **Who should the provider look for?** Name, phone, vehicle make (with suggestions), colour,
     optional model and email, and where the car is now: off the road in a safe place, on the
     shoulder of a highway, or somewhere unsafe (with the call 911 alert). Consent and the bot check
     sit above one full-width **Send my request**.
- **No email code step any more.** It added a fourth screen to a stranded customer's request. The
  email stays optional and unverified on the request; the code check stays for the customer account
  pages.
- **Errors say what to do next** ("Type your name so the provider knows who to look for.",
  "Type where to take the vehicle (an address or a shop name).") and keep everything already
  typed.
- **"Finding help" screen** (the status page while quotes are on the way): "N verified providers
  serve {city}" from real data, a "While you wait" list (hazard lights on, stay buckled in on a
  highway, keep the phone on, call 911 if unsafe), and the call link only where phones are enabled.
- The action bar is hidden on the request screens so the send button is the only thing pinned to
  the bottom of the phone.

### RSOS-102: Roles and permissions, defined in the admin

- **Roles** (database names kept, labels changed): Owner (`super_admin`), Operations manager
  (`ops_manager`), Dispatcher (`dispatcher`), Provider success (`support`), Finance (`finance`),
  Marketing (`marketing`), Viewer (`read_only`). Provider side: Provider owner (`owner`),
  Dispatcher (`manager`), Technician (`operator`).
- **One permission map** (`packages/config/src/permissions.ts`) drives the menu, the command
  palette and the shortcuts, and the **admin proxy refuses** any page or API outside the role's
  sections (`/no-access`, or 403 for APIs), so hiding menu items is not the only guard.
- **Database (RLS)**, migration `20261118010000_role_permissions.sql`: dispatchers read providers
  but can no longer edit them or see fee rows; provider success edits provider details and prices;
  fee rows are for owners, operations managers, finance and viewers.
- **Admin > Team & roles** (`/team`): every role with who it is for, what it can do and which
  sections it opens; team members with role and market scope; invite by email (production: the
  Supabase invite email; demo hosts: the invite link shown on screen); change role and markets;
  deactivate (the sign-in token stops carrying the role). Owners manage everyone, operations
  managers everyone except owners, and at least one active owner must remain. Every change is
  written to the audit log.
- **Profile**: the header shows "Dispatcher · San Antonio, Houston" (role and market scope).
- **Customer data**: phone numbers are masked for Marketing and Viewers on request pages.
- **Demo sign-in** offers all seven staff roles and the three provider roles.
- Tested:
  - unit `permissions.test.ts` (the role table, path guard, who manages whom, masking);
  - pgTAP `027_role_permissions` (per role: providers, fee rows, staff);
  - e2e `role-permissions.spec.ts` (allowed and refused sections and the menu per role, the Team
    and roles page) and `demo-sign-in.spec.ts` (all ten demo roles).

### RSOS-103: Admin rebuild (Today, navigation, dispatch board)

- **Navigation**, grouped and filtered by role (RSOS-102), each group folds and the choice is
  remembered: **Operate** (Today, Inbox, Dispatch board, Requests, Calls), **Network**
  (Providers, Recruitment, Reviews), **Business** (Markets, Pricing, Finance, Marketing, Test
  campaign, Analytics), **System** (Content, Team & roles, Settings, System status). On phones the
  same menu opens from a **Menu** button (the old strip of 16 links is gone).
- **Phone intake merged**: no longer a menu item; "Log a call" opens it from the Inbox and from
  Calls. Inbox = what a person must act on now; Dispatch board = live map and lanes; Requests =
  searchable history; Calls = the call log.
- **Today** replaces the overview:
  - top strip: needs action now (with the oldest wait), unanswered calls (missed or voicemail,
    not called back), requests with no quote after 3 minutes, providers available per market;
  - the 10 most urgent items, each with one action (Claim, Call back, Assign, Close);
  - today by market since local midnight: requests, filled, median time to assign, completed,
    and fees earned (owners, operations and finance only);
  - alerts: stale requests and markets with nobody available.
- **Calls**: the 7-day call log in a sortable table (36 px rows, sticky header, search, columns),
  outcome filters, row click opens the request, virtual scrolling past 100 rows.
- **Dispatch board**:
  - one market at a time (defaults to the first of the dispatcher's markets, kept in the address);
  - the map shows that market's neighbourhood names, pins at their coordinates, and pins closer
    than 22 map units merge into one numbered marker (no overlapping markers);
  - lanes New, Quoting, Picked, On the way, On site, plus **Needs closing** for anything with no
    progress for 2 hours;
  - timers read "45s", "12m 30s", "2h 14m", then "Stale · 2d"; amber at 3 minutes without a quote,
    red at 10 (with a "No quote" tag, never colour alone);
  - **Real / Demo / Both**, Real by default everywhere; demo cards carry a Demo tag;
  - the load test moved into Demo controls;
  - a card opens a side panel with the details and actions; J/K move, Enter opens, A assigns, C
    calls.
- **Every admin page** has a skeleton while loading and an error page with a retry; the new
  pages have empty states.
- **Customer wording** in the admin ("Call customer", "Customer's name"; the truck driver is the
  technician).
- **Demo badge** in the admin is the slim top strip (the corner badge covered a menu item).
- **Staging data cleanup**: 5 real requests stuck at "submitted" for more than 24 hours were
  closed as cancelled with reason "test cleanup", each with a request event and an audit log
  entry (`request.test_cleanup`). Nothing was sent to anyone.
- Timer formatting and colours are unit tested (`apps/admin/test/board-time.test.ts`).
- **Not done (recorded)**: failed webhooks are not tracked anywhere yet (only idempotency rows
  exist), so the alert says it appears once error monitoring is connected. The existing tables
  (Requests, Providers and others) keep their current layout; only Calls uses the new table.
- **Sign out** sits at the bottom of the menu for every role (it used to be on the overview).
- **Speed, measured** on this pull request's preview (Vercel, signed in as Owner, desktop Chrome,
  from the developer's machine; median of 3 client-side changes from Today):

  | Route     | JS over the network (compressed, cold) | First response | Page ready |
  | --------- | -------------------------------------- | -------------- | ---------- |
  | Today `/` | 208.6 KB                               | n/a            | n/a        |
  | Inbox     | 312.0 KB                               | 52 ms          | 1411 ms    |
  | Dispatch  | 214.2 KB                               | 62 ms          | 1546 ms    |
  | Requests  | 207.9 KB                               | 51 ms          | 1419 ms    |
  | Calls     | 247.7 KB                               | 51 ms          | 1606 ms    |
  | Providers | 209.3 KB                               | 51 ms          | 1573 ms    |
  | Team      | 209.9 KB                               | 49 ms          | 1411 ms    |

  Menu links now prefetch, so a click shows the page's skeleton in about 50 ms (under the 200 ms
  target); the data itself takes 1.4 to 1.6 s (server render plus database round trips from the
  preview region). The command palette loads on first open. JavaScript is about 208 KB on most
  routes against the 200 KB target, 312 KB on Inbox (live updates) and 248 KB on Calls (the
  table): **partial**, recorded for the owner.
