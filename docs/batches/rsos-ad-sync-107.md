# RSOS-107: Automatic ad sync (standalone copy)

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy into the repo as `docs/batches/rsos-ad-sync-107.md`. Same operating rules as batch 4.6: own branch and pull request into `staging`, CI green, squash-merge yourself, never touch `main`, no questions, secrets never printed. Use the funnel events and source/channel definitions from RSOS-111 and RSOS-113; do not duplicate them.

## RSOS-107: Automatic ad sync (spend import, conversion upload, auto-pause)

Build everything now behind feature flags, fully tested with fakes. The owner connects ad accounts later; connecting must need only keys in Vercel and a toggle in the admin.

Adapters (`packages/core/src/adapters/ads/`): `google-ads`, `meta`, `microsoft-ads`, each with a real implementation and a fake. Real ones switch on only when their keys exist and the toggle in Admin > Marketing > Connections is on.

1. **Connections page** (Admin > Marketing > Connections, Owner and Marketing roles): one card per platform showing Not connected / Connected / Error, last sync time, account name, and a "Test connection" button. Never shows key values.
2. **Spend import** (hourly cron, plus a nightly full re-pull of the last 7 days to catch late adjustments): pull spend, impressions and clicks per campaign per day. Map campaigns to a market and service with a naming rule (for example `SA | Tow | Search`) and a manual mapping table in the admin for anything that does not match. Store in `ad_spend_daily`. The manual spend form from RSOS-031 stays as a fallback and is used only for days with no imported data.
3. **Conversion upload** (hourly): send `call_qualified` (answered over 60 seconds), `request_submitted`, `job_assigned` and `job_completed` back to the platform that produced the click (Google: gclid, gbraid or wbraid offline conversions plus enhanced conversions with hashed phone where consent allows; Meta: Conversions API with event id deduplication against the Pixel; Microsoft: offline conversions with msclkid). Each upload is idempotent, retried with backoff, and logged with the platform's response. The daily CSV from RSOS-031 stays available as a manual fallback.
4. **Auto-pause safety:** every 5 minutes, per market, if no provider is online for a core service during the market's ad hours, pause that market's campaigns tagged for the service; resume when providers are back. Rules editable per market (on or off, minimum providers, grace period, default 10 minutes). Every pause and resume is logged and emailed to the owner. Off by default until the owner turns it on.
5. **Marketing dashboard:** per market and channel and date range: spend, clicks, calls, qualified calls, requests, assigned jobs, completed jobs, cost per request, cost per completed job, fees earned, return on ad spend (fees earned divided by spend). Small trend lines, CSV export. The Test campaign view reads from the same data.
6. **Daily owner email** at 8am owner time (configurable): yesterday per market, with anything unusual (spend with zero requests, cost per job above a threshold, failed syncs).
7. **Sync health** on System status: last successful run per job, errors, and an alert to the owner after 3 consecutive failures.

Keys (read only from server environment, never sent to the browser):

| Platform      | Variables                                                                                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Ads    | GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID (manager account), GOOGLE_ADS_CUSTOMER_ID (ads account), GOOGLE_ADS_CONVERSION_ACTION_IDS (JSON map of our event names to conversion action ids) |
| Meta          | META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID, NEXT_PUBLIC_META_PIXEL_ID, META_CAPI_TEST_EVENT_CODE (staging only)                                                                                                                                                                     |
| Microsoft Ads | MS_ADS_DEVELOPER_TOKEN, MS_ADS_CLIENT_ID, MS_ADS_CLIENT_SECRET, MS_ADS_REFRESH_TOKEN, MS_ADS_ACCOUNT_ID, MS_ADS_CUSTOMER_ID                                                                                                                                                         |

Write `docs/runbooks/ads-connections.md`: exact steps to get each key, the campaign naming rule, how to create the conversion actions in Google Ads (names must match our event names), and how to test on staging.

Acceptance: with fakes, a test proves spend import, conversion upload (idempotent), auto-pause and resume, and dashboard numbers end to end. Without keys, Connections shows "Not connected" and nothing errors. Cron jobs authenticate with `CRON_SECRET`.
