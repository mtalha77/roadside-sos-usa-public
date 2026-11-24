# RSOS-117: Simple booking commitment, live tracking and proof of service

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy this file into the repo as `docs/batches/rsos-booking-commitment.md`. Run after RSOS-116. Same operating rules as batch 4.6: own branch and pull request into `staging`, CI green, squash-merge yourself, never touch `main`, no questions, secrets never printed. Attach before and after screenshots.

**Owner decision: customers are not charged anything at launch.** The customer booking fee in section A is built behind a feature flag that is **off in every market and every environment by default**, and hidden from customers while off (no fee text, no payment step, no card collected). With the flag off, the customer path skips step 2 below and goes straight from picking to tracking. Everything else in this ticket (tracking, completion code, provider fee reserve and charge, proof of service, flags) works without any customer payment. Customer reliability rule D uses blocking only (no fee) while the flag is off.

**Owner rule: keep it simple for both sides.** The customer and the provider each see only a few taps. Everything else (fee reserve, GPS checks, fraud signals) runs in the background. If a screen needs explaining, it is too complex.

This ticket changes RSOS-038: the provider fee is **reserved** at pick and **charged** on proof, instead of deducted at pick. Number sharing still happens only after the fee is reserved.

---

## What the customer does (4 steps)

1. **Picks a quote** (or Instant book books one).
2. **Pays the booking fee with one tap** (see section A). Apple Pay or Google Pay on phones, card as fallback.
3. **Watches the tracking page:** provider name and photo, truck and plate, locked price, live countdown, truck on the map, status updates. A short "While you wait" checklist (hazard lights, stay in the vehicle on a highway, have ID ready for lockouts). A **4-digit completion code** shown in large type: "Give this code to the provider when the job is done."
4. **Taps "Yes, fixed" or "No"** when the job is finished, plus an optional star rating.

Backup promise on the tracking page: if the provider is more than 15 minutes later than the arrival time, a button "Find me another provider" appears; one tap re-sends the request with priority and refunds the booking fee if the new provider is not found.

Notifications at each status change: browser push (if allowed) and email. Browser tab title shows the countdown.

## What the provider does (4 taps)

1. **Accept** (or quote, then picked).
2. **On my way** (one tap; starts sharing location while the job is active).
3. **Arrived:** set automatically when the phone is within about 200 m of the customer; manual tap allowed only inside that range.
4. **Done:** enter the customer's 4-digit code. If the customer is not there (for example a tow dropped at a shop), tap "Customer not available" and take 2 photos with the in-app camera instead.

Photos are optional in every other case. No other forms.

---

## A. Customer booking fee (default 5 USD)

- Charged once, **when the customer picks a provider**, never before quotes.
- Payment: Stripe Payment Element with Apple Pay, Google Pay and Link first, card fallback. No account creation. The button reads "Confirm booking, 5 USD".
- Shown up front on the quote list: "Booking fee 5 USD, paid to us. You pay the provider directly for the job." The provider's quoted price does not change.
- **Automatic full refund** if: the provider cancels, the provider does not arrive within 30 minutes after the promised arrival time, the backup re-send finds nobody, or support approves a complaint.
- **No refund** if the customer cancels after the 2-minute free cancel window (shown on the pick screen: "Free cancel for 2 minutes").
- Admin controls per market (Admin > Business > Plans & pricing): on or off, amount, free cancel window. Default: **off**, 5 USD, 2 minutes. Only the Owner can turn it on.
- Test-campaign option: turn it on in some markets and off in others to measure the effect on bookings; the Analytics funnel shows "Picked" and "Paid booking fee" per market.
- Payments use the fake billing adapter until batch 6 switches on Stripe; the flow, refunds and ledger are fully built and tested now.
- Revenue from booking fees appears as its own line in Finance and in the Economics model (RSOS-113) as "Customer booking fees, net of card fees".

## B. Provider fee: reserve, then charge (background, no provider action)

| Moment                                                                                                            | Provider wallet                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Customer picks and pays the booking fee                                                                           | Fee **reserved** (held, not spendable). Numbers shared.                                                                    |
| First proof: code entered, GPS arrival, customer taps "Yes, fixed", or 60 minutes pass with no valid cancellation | Reserved fee **charged**                                                                                                   |
| Customer cancels before arrival                                                                                   | Reserved fee **released** in full                                                                                          |
| Provider reports no-show                                                                                          | Released only if GPS shows the provider at the location and the customer did not respond for 15 minutes; otherwise charged |
| Provider cancels                                                                                                  | Released, and counted in the provider's cancel rate                                                                        |

- Bonus credit (RSOS-115) is reserved first, then paid balance.
- If a provider reports "customer cancelled" and the customer later taps "Yes, fixed", the fee is charged and the provider is flagged.
- Approved no-show releases are limited to 3 per provider per month (admin-editable); above that, admin reviews each one.

## C. Proof of service and warning signs (background)

- Every status change stores time and GPS.
- Completion code: 4 digits, unique per job, shown only to the customer; 5 wrong tries lock it and notify admin.
- Customer confirmation is asked once, after "Done" (push and email). "No" opens a simple dispute with one text box.
- Automatic flags shown in Admin (Inbox and provider profile): done without arriving, job time under 5 minutes, high cancel or no-show rate, customer and provider on the same device, many "customer not available" completions.
- Spot check list: 5% of completed jobs per week appear in a "Confirm with customer" queue for support.

## D. Customer reliability (background)

- Track customer no-shows and late cancels by phone, email and device.
- 2 no-shows in 90 days: the next booking needs the booking fee even in markets where it is off. 3 or more: blocked, with a support contact.

## Acceptance

- e2e with the booking fee flag **off** (default): customer picks and goes straight to tracking with no payment step and no fee text anywhere.
- e2e with the flag on: customer picks, pays 5 USD (fake adapter), sees tracking with code; provider taps On my way, arrives (GPS mocked), enters code; fee moves from reserved to charged; customer taps Yes, fixed and rates.
- e2e: customer cancels within 2 minutes gets a refund and the provider fee is released; after 2 minutes no refund.
- e2e: provider late by 15 minutes, customer taps "Find me another provider", booking fee refunded if no new provider.
- Unit tests: reserve, charge and release rules; refund rules; no-show limits; code lockout; flags.
- Screenshots: pick screen with booking fee, tracking page with code, provider's 4-step job screen, admin flags.
- Count of taps: customer path after picking is 3 taps (pay, then "Yes, fixed" plus optional rating); provider path is 3 taps plus the code.
