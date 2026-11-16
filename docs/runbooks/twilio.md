# Runbook: Twilio (calls, texts, codes, browser softphone)

Batch 4 (RSOS-030, 074b, 035, 021b). Values go only into Vercel environment variables; never into
the repository, chat or logs. Staging and production are kept apart: **separate numbers, separate
Messaging Services and separate TwiML Apps**, so test traffic never reaches real drivers.

## Keys (Vercel, per project, Preview for `staging` and Production)

| Variable                       | Projects             | What it is                                                          |
| ------------------------------ | -------------------- | ------------------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID`           | web, provider, admin | Account SID (AC…)                                                   |
| `TWILIO_AUTH_TOKEN`            | web, provider, admin | Auth token: signs and checks webhooks. Sensitive.                   |
| `TWILIO_API_KEY_SID`           | admin                | API key SID (SK…), for softphone access tokens                      |
| `TWILIO_API_KEY_SECRET`        | admin                | API key secret. Sensitive.                                          |
| `TWILIO_VERIFY_SERVICE_SID`    | web, provider, admin | Verify service (VA…): driver phone checks and SMS sign-in           |
| `TWILIO_MESSAGING_SERVICE_SID` | web, provider, admin | Messaging Service (MG…), **different per environment**              |
| `TWILIO_TWIML_APP_SID`         | admin                | TwiML App (AP…) for browser calls, **different per environment**    |
| `OWNER_TEST_PHONE`             | admin (staging only) | The owner's mobile for manual QA texts and calls                    |

Without keys every Twilio feature uses its fake (nothing is sent; Admin > Settings > System status
shows **Fake**). Production without keys shows **Missing** and the features are off.

## Phone numbers (per market and source)

1. Buy one local number per market and source you will run (for the test campaign at least:
   `website` and `google_ads` per market) plus one `staging_test` number. Use friendly names like
   `san-antonio google_ads`.
2. For every **production** number, set in Twilio > Phone Numbers > the number:
   - Voice, "A call comes in": Webhook, `https://admin.<domain>/api/twilio/voice`, HTTP POST.
   - Call status changes: `https://admin.<domain>/api/twilio/voice/status`, HTTP POST.
   - Messaging: the **production** Messaging Service.
3. For the **staging** number, the same paths on `https://staging-admin.<domain>`, with the Vercel
   protection bypass added to each URL (staging hosts are protected):
   `https://staging-admin.<domain>/api/twilio/voice?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>`.
   Messaging: the **staging** Messaging Service.
4. In Admin > Settings > Phone numbers, add each number with its market and source, then press
   **Sync from Twilio** (it only reads Twilio and stamps the numbers it finds).

## Messaging Services (one per environment)

- Add the environment's numbers as senders.
- Integration > Incoming messages: "Send a webhook" to `https://admin.<domain>/api/twilio/messages`
  (staging: the staging admin host with the bypass parameter).
- Delivery status callbacks are set per message by the app (`/api/twilio/messages/status`).
- Opt-out management: keep Twilio's default STOP handling on; the app also stores opt-outs and
  refuses to text opted-out numbers.
- Until A2P 10DLC is approved texts to non-test numbers are held (see `a2p-10dlc.md`).

## TwiML Apps (browser softphone, one per environment)

- Voice request URL: `https://admin.<domain>/api/twilio/client` (POST); staging uses the staging
  admin host with the bypass parameter.
- Put the App SID in `TWILIO_TWIML_APP_SID` for that environment.

## Verify

- Create a Verify service (code length 6, SMS channel). Put its SID in `TWILIO_VERIFY_SERVICE_SID`.
- Our own limits apply on top: 3 codes per phone per 10 minutes, 10 per IP per hour.

## Call recording

Off by default. Turn it on per market only where legal and wanted (the market's
`call_recording_enabled`); callers then hear the recording notice. Recordings stay in Twilio and
are played only through the admin (signed-in staff who can see that market).

## Check it works (owner)

1. Admin > Settings > System status: Twilio texts and calls, Verify and Browser softphone show
   **Real** on staging.
2. Call the staging test number; answer in the admin softphone.
3. Missed-call and voicemail texts reach the on-duty dispatcher's mobile (Settings > On duty).
