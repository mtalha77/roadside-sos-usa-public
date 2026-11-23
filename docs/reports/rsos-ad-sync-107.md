# RSOS-107 run report: automatic ad sync

Specification: `docs/batches/rsos-ad-sync-107.md` (the owner sent it on 2026-11-19, unblocking the
batch 4.6 prerequisite). Owner's instruction with it: all ad platforms stay off until keys exist;
everything tested with fakes.

| Work                                      | Status    | Pull request |
| ----------------------------------------- | --------- | ------------ |
| RSOS-107 Automatic ad sync                | Merged    | #204         |
| Owner decision 2: test traffic marker     | Merged    | #205         |
| Owner decision 3: request flags           | In review | #206         |
| Owner decision 4: Mobile Safari CI timing | Merged    | #202         |

## RSOS-107: Automatic ad sync

- **Adapters** (`packages/core/src/adapters/ads/`): Google Ads (REST: GAQL spend,
  `uploadClickConversions` with the event id as order id, campaign status), Meta (Graph API
  insights, Conversions API with our event id for Pixel deduplication, campaign status) and
  Microsoft Ads (offline conversions by msclkid, campaign status), each with a fake. A platform
  is used only when every key is set in the server environment and its switch is on; without
  keys it is "Not connected" and nothing errors.
- **Connections** (Admin > Marketing > Connections; the owner and marketing change it): a card per
  platform (Not connected, Off, Connected or Error, last sync, account name, Test connection, the
  switch), market codes for the naming rule, campaigns with a manual market and service mapping,
  and the auto-pause rules per market. Key values are never read into a page.
- **Spend import**: hourly (yesterday and today) and nightly (the last 7 days), per campaign per
  day into `ad_spend_daily`, mapped with `CODE | Service | Type` or by hand. The manual spend form
  stays and is used only for days with no imported data (the dashboard and Test campaign both read
  `ad_dashboard`, which applies that rule).
- **Conversion upload**: hourly, `call_qualified` (answered over 60 seconds), `request_submitted`,
  `job_assigned`, `job_completed` back to the platform that produced the click; one log row per
  platform and event (idempotent), failures retried with backoff (5 minutes doubling, at most a
  day, 8 tries), the platform's response kept. The daily Google CSV stays as a manual fallback.
- **Auto-pause**: every 5 minutes, per market, off by default; minimum providers, grace period
  (default 10 minutes) and ad hours editable; pauses and resumes the market's campaigns tagged for
  the service, logged on the Connections page and emailed to the owner.
- **Marketing dashboard**: per market and channel for the date range: spend, clicks, calls,
  qualified calls, requests, assigned and completed jobs, cost per request, cost per completed job,
  fees earned and return on ad spend (fees earned divided by spend), a spend trend line, CSV
  export.
- **Daily owner email**: checked hourly, sent once at the owner's hour (system settings
  `ads_email_hour`, default 8, in `owner_time_zone`): yesterday per market and anything unusual
  (spend with zero requests, cost per completed job above `ads_max_cost_per_job_cents`, failing
  syncs).
- **Sync health**: Settings > System status lists each job's last success and failures in a row;
  the owner is emailed once at the third failure in a row.
- **Schedules**: Vercel Hobby allows only daily crons, so the nightly re-pull is a Vercel Cron and
  the hourly and 5-minute jobs run from the GitHub workflow `ads-sync.yml`, which does nothing
  until the owner sets `ADS_SYNC_ADMIN_URLS` and `CRON_SECRET` (see the runbook). Every job needs
  `CRON_SECRET`.
- **Runbook**: `docs/runbooks/ads-connections.md` (every key, the naming rule, Google conversion
  actions, testing on staging).

**Not done as specified**

- Microsoft spend import: Microsoft delivers spend only as zipped report files; until that import
  is built, Microsoft spend comes from the manual form (conversions and auto-pause work).
- Enhanced conversions with a hashed phone: wired in the Google and Meta adapters, sent as empty
  because the website does not collect an advertising consent yet.
- Auto-pause "provider online": real providers have no online status yet, so it counts active
  real providers with a price for the service.
- No adapter has run against a live account; the first live check is the runbook's staging test.

**Tests**: unit (`packages/core/test/ad-sync.test.ts`: not connected without keys, spend import and
mapping with imported spend winning over manual, idempotent conversion upload with retries and
backoff, auto-pause and resume with the grace period and ad hours, dashboard numbers, unusual
days, sync health, and each real adapter's requests against a stubbed network), database
(`supabase/tests/036_ad_sync.test.sql`) and e2e (`ad-sync.spec.ts`: Not connected without keys,
the dashboard and its CSV, cron jobs refuse calls without the secret).

## Owner decision 2: test traffic

- The 15 test rows in staging's `funnel_events` (ids 6 to 20: 11 from the batch 4.6 timing check,
  4 from the staging smoke test) were exported to `docs/reports/test-funnel-rows.csv` and deleted
  on 2026-11-19, with an `audit_log` entry (`analytics.test_rows_deleted`). Other test rows on
  staging from Release QA and later smoke runs were not deleted (outside the owner's approval);
  they predate the marker.
- **The marker** (migration `20261120040000_test_traffic.sql`): a website request is test traffic
  when the session started with `?rsos_test=1` (session cookie), the browser opened a test device
  link (long-lived device cookie, checked against the list), its IP is on the list (single address
  or range), or staff are signed in to the admin in that browser (the admin sets a `rsos_test=staff`
  cookie on the shared parent domain; previews and local hosts have none). The website then sends
  `x-rsos-test: 1` on its database calls, and the database tags `requests.is_test` and
  `funnel_events.is_test`, creates no conversion events for test requests (so nothing reaches an ad
  platform, the marketing report or the ads dashboard) and does not count test visits.
- **Excluded everywhere**: Analytics, booking speed on Today, the funnel panels, Test campaign and
  the website's booking-speed promise. **Include test traffic** (Analytics, Real view) is offered on
  staging and previews only.
- **The list**: Settings > System > Test traffic (owner, operations manager, marketing): add an IP
  or range, create a device link (open it once on the phone), remove; every change in the audit log.
- Tests: unit (`apps/web/test/test-traffic.test.ts`), database
  (`supabase/tests/037_test_traffic.test.sql`: tagging, no conversions, no visit count, the list
  and who changes it) and e2e (`test-traffic.spec.ts`).

## Owner decision 3: flagging, both sides

- **Customer**: "Report a problem" is always on the tracking page, during the job and after
  completion. Sending takes one tap on a reason, with an optional note: provider didn't arrive,
  price changed, poor service, safety concern, or other. On real requests it calls
  `flag_request_as_customer` with the tracking link's token. This replaces the earlier report
  form, which sent a contact message.
- **Provider**: "Flag this request" on the incoming-request screen, the job detail and the active
  job. It works the same way: one tap on a reason, optional note. Reasons: fake or prank, wrong
  location, customer unreachable, unsafe, other. On a real request (one the company was offered
  in dispatch or assigned) it calls `flag_request_as_provider`. The provider portal still runs on
  the demo stream, so demo requests only show the confirmation.
- **Database** (migration `20261120050000_request_flags.sql`): table `request_flags` with side,
  reason, note, priority, status and resolution, plus the provider involved. Safety and unsafe are
  **urgent** and mark the request urgent. Other rules:
  - at most three flags per side per request;
  - every flag and resolution goes on the request timeline, and resolutions also go in the audit
    log;
  - flags from test traffic are tagged `is_test`.
  - RLS: staff read flags in their markets; a provider reads only the flags its company raised;
    visitors read nothing.
- **Admin**:
  - The Inbox lists flagged requests even after completion. Urgent flags sort to the top, with a
    flag count badge, and the list reloads live.
  - The request panel and the request page show the flags with a resolve form (dispatchers,
    operations, support).
  - The request page also shows "Flags about this customer": provider flags on any request from
    the same phone number. There is no customer profile page yet, so this is the customer's
    profile view for now.
  - The provider page shows "Flags from customers".
- **RSOS-117** (fraud signals and reliability scores) has no specification yet.
  `request_flag_counts(provider, phone)` returns the per-reason counts it will read (test traffic
  excluded).
- Tests: database (`supabase/tests/038_request_flags.test.sql`: reasons per side, urgent safety,
  who may flag, who reads, resolve) and e2e (`request-flags.spec.ts`: the customer's one-tap
  report, a provider flag, and a real request's safety report shown urgent and flagged in the
  Inbox, then resolved by a dispatcher).

## Owner decision 4: Mobile Safari CI timing

Investigated within the time box (#202). The full-demo test stalled on WebKit on CI at "On the
way". The CI trace showed the page had stopped painting and its main thread was starved. On those
stages the tracking map drew a second, endlessly looping SMIL truck next to the live one, and
WebKit without a GPU fell behind repainting it. The clock and the booking logic were correct.

- **Fix:** the map shows only the live truck. That also removes a visible defect, since customers
  saw two trucks.
- **Result:** the test's CI-only `fixme` was removed, and the test runs and passes on WebKit in CI.
  No quarantine was needed.

## CI reliability fixes made on the way

These were found while getting this run's PRs green. Each one failed every PR, not only the one it
surfaced on.

- **`SUPABASE_ACCESS_TOKEN` expired:** it was a 7-day token. The owner renewed it with 90 days on
  2026-11-20, and a reminder is set for 2027-02-11.
- **Market page:** it listed every tracking number (311 on rsos-dev from test runs), which went past
  WebKit's screenshot limit. It now shows 12 and links to Settings.
- **Credits page on phones:** hidden table labels and the duplicate-review buttons overflowed at
  375 px.
- **Fictional numbers:** tests that file requests drew from only 90 numbers, so the 30-minute
  duplicate rule reopened another run's request. A shared `fakeMobile()` now draws from
  6,000 (900 still collided with several PRs testing at once).
- **Incoming-request test:** it now waits out the demo stream's quiet spells (up to about 50 s with
  no open request).
- **Database tests:** they now insert complete requests (service, market service, pickup), as the
  `requests_complete_unless_intake` check requires.
- **e2e job time limit:** raised from 30 to 50 minutes. The runner's package mirror served the
  browsers' system libraries at about 123 kB/s twice in one day.
