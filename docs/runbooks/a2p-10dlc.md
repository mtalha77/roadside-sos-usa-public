# Runbook: A2P 10DLC registration (texting from local numbers)

US carriers require every business that texts from local (10-digit) numbers to register a
**brand** and a **campaign**. Until both are approved, carriers filter or block our texts (Twilio
error 30034). The app holds texts to anyone but test numbers until you mark the registration
approved (Admin > Settings > Texts and templates), or turn on the override.

## What to register (Twilio Console > Messaging > Regulatory Compliance)

1. **Brand** (once per business):
   - Legal business name, EIN, business type, address and website: the company that operates the
     brand in `packages/config/src/brand.ts`.
   - Vertical: Transportation (or Professional Services if Transportation is not offered).
   - A standard brand (not sole proprietor) gives higher throughput.
2. **Campaign** (once per use case), attached to each environment's Messaging Service:
   - Use case: **Customer care** (choose "Mixed" only if you also send account notifications to
     providers from the same service).
   - Description: "Roadside assistance dispatch: we text drivers who asked for help a link to
     share their location, the provider assigned to them with price and arrival time, and a
     tracking link. Providers receive job alerts. No marketing messages."
   - Message flow / opt-in (must match the product exactly):
     - Web: the driver submits the Get Help form at `/get-help`. Above the submit button the form
       says: "By continuing you agree to the Driver Terms and Privacy Policy, and to receive text
       messages about this request (message and data rates may apply; reply STOP to stop)." The
       driver confirms their number with a one-time code.
     - Phone: the driver calls our number; the call flow tells them we will text a location link,
       and the first text includes "Reply STOP to opt out."
   - Sample messages (taken from our templates, Admin > Settings > Texts and templates):
     1. "Thanks for calling {brand}. Share your exact location here: {link} Reply STOP to opt out."
     2. "Hi {first_name}, {provider} is on the way. Quoted price {price}, about {eta} min. Track
        here: {link}"
     3. "Hi {first_name}, we are still finding a provider near you. We will text you as soon as
        one confirms."
     4. "{brand}: roadside help dispatch. For support email {support}. Reply STOP to opt out.
        Msg & data rates may apply." (HELP reply)
   - Opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT. Opt-in keywords: START,
     UNSTOP, YES. Help: HELP, INFO. (The app also records opt-outs itself and never texts an
     opted-out number.)
   - Embedded links: yes (location and tracking links on our own domain). Embedded phone
     numbers: no. Age-gated content: no. Lending: no.
   - Privacy policy URL: `https://<domain>/legal/privacy` (has a "Text messages" section).
     Terms URL: `https://<domain>/legal/sms-terms`.
3. Wait for approval (usually days, sometimes weeks). Twilio emails the result.

## After approval

- Admin > Settings > Texts and templates: set **Approved**. The banner in the admin disappears and
  held texts are no longer created.
- Check the delivery table there for a few days: delivered should be close to sent; watch for
  30007 (carrier filtering) and 30034 (registration missing).

## Before approval (test campaign)

- Texts to `OWNER_TEST_PHONE` (staging) and to staff mobile numbers (Settings > On duty) are sent
  normally, so the owner can test.
- The override ("Send to everyone anyway") exists for emergencies only: unregistered traffic may
  be blocked by carriers and can lead to fines from Twilio's carriers.

## Quiet hours

Non-urgent texts (for example the review request after a job) are held between 9pm and 8am in the
market's time zone. Job texts (location link, provider assigned, dispatcher replies, HELP) are
urgent and go out at any time.
