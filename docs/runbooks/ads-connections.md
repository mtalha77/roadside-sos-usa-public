# Ad connections (RSOS-107)

How to connect Google Ads, Meta and Microsoft Ads to the admin's automatic ad sync: spend import,
conversion upload and auto-pause. Nothing runs against a platform until its keys are in the server
environment **and** its switch is on in Admin > Marketing > Connections. Keys live only in Vercel
(admin project, server variables): never in the repository, never in the browser.

## What runs and when

| Job           | When                             | What                                                                                                                                                                                                                 |
| ------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spend`       | hourly                           | Spend, impressions and clicks per campaign for yesterday and today                                                                                                                                                   |
| `spend-full`  | nightly (Vercel Cron, 09:15 UTC) | The last 7 days again (late adjustments)                                                                                                                                                                             |
| `conversions` | hourly                           | `call_qualified`, `request_submitted`, `job_assigned`, `job_completed` back to the platform that produced the click; once per event (idempotent), retried with backoff (5 minutes, doubling, at most a day, 8 tries) |
| `autopause`   | every 5 minutes                  | Pauses a market's campaigns for a service when fewer providers than the minimum are available during ad hours, after the grace period; resumes when they are back (off by default per market)                        |
| `daily-email` | hourly                           | At the owner's hour (default 8) in `owner_time_zone`: yesterday per market and anything unusual                                                                                                                      |

All jobs are `GET /api/cron/ads/<job>` on the admin host with `Authorization: Bearer $CRON_SECRET`.
Vercel Hobby only allows daily crons, so the hourly and 5-minute runs come from the GitHub
workflow `.github/workflows/ads-sync.yml`. To turn it on, set in GitHub (Settings > Secrets and
variables > Actions):

- variable `ADS_SYNC_ADMIN_URLS`: the admin base URLs to run against, space separated (staging
  first; add production when ready);
- secret `CRON_SECRET`: the same value as the admin project's `CRON_SECRET` in Vercel.
  `VERCEL_AUTOMATION_BYPASS_SECRET` (already set) lets it reach the protected staging host.

Every run is recorded (Settings > System status > Ad sync health). After 3 failures in a row the
owner is emailed once.

## Campaign naming rule

Name every campaign `CODE | Service | Type`, for example `MA | Tow | Search`:

- `CODE`: the market's code, set in Admin > Marketing > Connections > Market codes (2 to 6
  capital letters or digits);
- `Service`: the service's name or slug as on the website (`Tow`, `Flat tire`, `flat-tire`);
- `Type`: anything (Search, Performance Max, ...); it is not used for mapping.

Campaigns that do not match are listed under Campaigns as "Not mapped": choose the market (and
service) by hand. Spend from unmapped campaigns is not counted in any market. Auto-pause only
pauses campaigns with a service.

## Google Ads

1. **Developer token**: in the Google Ads manager account (MCC), Tools > API Center. Apply for
   Basic access (Explorer access works for testing). → `GOOGLE_ADS_DEVELOPER_TOKEN`.
2. **OAuth client**: Google Cloud console > APIs & Services: enable "Google Ads API"; create an
   OAuth client of type "Web application". → `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`.
3. **Refresh token**: with the OAuth Playground (gear icon: "Use your own OAuth credentials"),
   scope `https://www.googleapis.com/auth/adwords`, sign in with a user who can access the ads
   account, exchange the code. → `GOOGLE_ADS_REFRESH_TOKEN`.
4. **Account ids**: the manager account id → `GOOGLE_ADS_LOGIN_CUSTOMER_ID`; the ads account id →
   `GOOGLE_ADS_CUSTOMER_ID` (with or without dashes).
5. **Conversion actions**: in the ads account, Goals > Conversions > New conversion action >
   Import > "Other data sources or CRMs" > "Track conversions from clicks". Create four, named
   exactly `call_qualified`, `request_submitted`, `job_assigned`, `job_completed` (count: One;
   value: use the value we send for the last two). Copy each action's id (in its URL, `ctId=`) into
   `GOOGLE_ADS_CONVERSION_ACTION_IDS` as JSON, for example
   `{"request_submitted":"123","call_qualified":"124","job_assigned":"125","job_completed":"126"}`.
6. Optional: `GOOGLE_ADS_API_VERSION` (default `v19`) when Google retires a version.

Enhanced conversions with a hashed phone are wired in the adapter but stay off: the website does
not collect an advertising consent yet.

## Meta

1. Business Settings > Users > System users: add a system user (Admin), assign the ad account
   and the pixel (dataset), generate a token with `ads_read`, `ads_management` and the Conversions
   API permission. → `META_SYSTEM_USER_TOKEN`.
2. The ad account id (numbers only, without `act_`) → `META_AD_ACCOUNT_ID`.
3. The pixel (dataset) id → `NEXT_PUBLIC_META_PIXEL_ID` (already used by the website pixel).
4. Staging only: Events Manager > Test events > test code → `META_CAPI_TEST_EVENT_CODE`, so
   staging conversions show in the test tab and never in reporting.

Conversions use our event id as Meta's `event_id`, so they deduplicate against the browser pixel.

## Microsoft Ads

1. Microsoft Advertising > Tools > Developer portal: request a developer token. →
   `MS_ADS_DEVELOPER_TOKEN`.
2. Azure portal > App registrations: register an app (accounts in any organizational directory
   and personal Microsoft accounts), add a client secret. → `MS_ADS_CLIENT_ID`,
   `MS_ADS_CLIENT_SECRET`.
3. Refresh token: sign in once through the OAuth flow with scope
   `https://ads.microsoft.com/msads.manage offline_access`. → `MS_ADS_REFRESH_TOKEN`.
4. Account and customer ids (shown in the Microsoft Advertising URL as `aid` and `cid`). →
   `MS_ADS_ACCOUNT_ID`, `MS_ADS_CUSTOMER_ID`.
5. In Microsoft Advertising, create offline conversion goals named exactly like our four events.

Microsoft sends spend only as zipped report files; that import is not built yet, so Microsoft spend
still comes from the manual spend form on the Marketing page. Conversions and auto-pause work.

## Testing on staging

1. Add the keys to the admin project in Vercel for the Preview (staging) environment only, then
   redeploy staging.
2. Admin > Marketing > Connections: the card says "Off". Press **Test connection**: it shows the
   account name or the platform's error (never a key).
3. Switch it on. Run the workflow by hand (Actions > Ads sync > Run workflow, job `spend`) and
   check: campaigns appear under Campaigns, spend under Marketing > Ads by market and channel.
4. Conversions: send a test request from the staging website through an ad link with a test click
   id, then run job `conversions`; the upload log is in `ad_conversion_uploads` (Google shows
   offline conversions after a few hours; Meta immediately in its test tab).
5. Auto-pause: set a rule for one market with a high minimum and a 0-minute grace period, run job
   `autopause`, and check the pause log on the Connections page and the owner email; set it back.

## Known limits

- Real providers have no "online" status yet: auto-pause counts active real providers with a price
  for the service as available.
- The adapters follow each platform's public API, but none has been run against a live account
  here; the first live test is step 2 above.
