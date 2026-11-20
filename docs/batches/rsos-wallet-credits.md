# RSOS-115 and RSOS-116: Wallet bonus credits, complete service forms and navigation fix

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy this file into the repo as `docs/batches/rsos-wallet-credits.md`. Run after RSOS-114. Same operating rules as batch 4.6: own branch and pull request into `staging`, CI green, squash-merge yourself, never touch `main`, no questions, secrets never printed. Attach before and after screenshots. Real money top-ups come in batch 6; this ticket works fully with the wallet ledger and the fake billing adapter.

## Goal

The owner can give providers free wallet balance ("bonus credit") from the admin: automatically when they join, and any time after that, to individuals or groups. Bonus credit pays our job fees so new providers can win their first jobs before topping up.

## Two kinds of balance (shown separately everywhere)

|                            | Paid balance                                | Bonus credit                                                                                     |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Comes from                 | Provider top-ups (batch 6)                  | Admin grants and campaigns                                                                       |
| Pays for                   | Job fees, and plans if the provider chooses | Job fees only by default. Each campaign can also allow paying the monthly plan (off by default). |
| Expires                    | Never                                       | Yes, per grant (default 60 days; editable)                                                       |
| Refundable or withdrawable | Per terms (batch 6)                         | Never. Not cash, no value outside the platform.                                                  |
| Spent first                | Second                                      | **First** (oldest expiring grant first)                                                          |

Provider wallet screen: "Paid balance 0.00 USD", "Bonus credit 50.00 USD, expires Jan 18", total available, and a ledger line for every grant, use and expiry.

## Ways to give credit (all in Admin > Business > Wallet credits)

1. **Signup bonus (automatic):** per market, amount (for example 30, 50 or 100 USD), expiry days, on or off, start and end dates.
   - Granted when the provider is **approved** (verification complete and a plan active), not at sign-up, to prevent fake accounts collecting bonuses.
   - Once per business: duplicate checks on EIN, business phone, insurance policy number, bank account (batch 6) and device. A blocked duplicate is flagged for review, not silently refused.
2. **Manual grant:** to one provider, with amount, expiry, reason (required, from a list: goodwill, dispute, promotion, test, other with note). Shown on the provider's timeline.
3. **Bulk campaign:** to a group (all providers in a market, a service, a plan, inactive for 30+ days, or a pasted list), with amount, expiry, message shown to providers, and a **total budget cap**. Preview who receives it and the total cost before confirming.
4. **Rule-based bonuses (optional, off by default):**
   - Milestone: for example 20 USD after the first 10 completed jobs.
   - Referral: a provider who refers another provider gets X USD when the new provider completes their first 3 jobs.
   - Reactivation: credit for providers who come back online after 30 days inactive.
     Each rule has an amount, expiry, budget cap and on/off switch per market.

## Controls and safety

- **Approval limits by role:** Operations manager up to 100 USD per grant and 1,000 USD per campaign; above that needs the Owner. Owner unlimited. Finance can view. Limits editable by the Owner.
- **Every grant, use, expiry and reversal** is written to the wallet ledger and the audit log (who, when, why).
- **Reversal:** the Owner can remove unused bonus credit (for example fraud); used credit cannot be reversed.
- **Refunded job fee:** if a job fee paid with bonus credit is refunded (cancelled or approved dispute), it returns as bonus credit with the original expiry or 14 days, whichever is later.
- Expiry reminder to the provider 7 days and 1 day before (email; in-app notice).
- Credits are never shown to customers and never change the customer's price.

## Accounting and analytics

- Job fees paid with bonus credit count as **fee revenue at full value** but the credit used is booked as a **promotion cost**, so the Economics model (RSOS-113) shows: fee revenue, minus promotion credits used, equals net fee revenue.
- **Outstanding bonus credit** (granted, not yet used or expired) is shown as a liability total on the Finance page, per market.
- Campaign report: credit granted, used, expired, providers who later topped up with real money ("conversion to paid"), jobs completed using credit, and net revenue from those providers in the following 60 days.
- Add a "Signup bonus per provider" input to the Economics model, used to estimate the cost of recruiting providers in each market.

## Provider-facing copy

- On approval: "Welcome. We added 50 USD bonus credit to your wallet. It pays your fees on your first jobs and expires on Jan 18."
- Pricing page FAQ: "What is bonus credit?" — "Free balance we add for new providers and promotions. It pays job fees, is used before your paid balance, and expires on the date shown. It is not cash and cannot be withdrawn."
- Terms: add a bonus credit clause (for attorney review).

## Acceptance

- Unit tests: spend order (bonus first, oldest expiry first), expiry job, refund back to bonus credit, approval limits, budget cap stops a campaign at its limit, duplicate business detection, signup bonus granted only on approval.
- e2e: Owner sets a 50 USD San Antonio signup bonus, a new provider is approved and sees 50 USD bonus credit, wins a job, the fee is taken from bonus credit, the ledger shows each step; a bulk campaign preview shows recipients and total before confirming.
- Screenshots: Admin Wallet credits (signup bonus, manual grant, campaign preview), provider wallet with both balances, Finance outstanding credit.

---

# RSOS-116: Complete request forms per service, and back navigation fix

Run after RSOS-115 in the same way (own branch and pull request into `staging`). This ticket updates the Get Help flow from RSOS-101 and batch 4.6; keep its 3-screen limit and Instant book.

## Problem (owner report)

1. The forms do not ask the details a provider needs for each service, so quotes can be wrong or the wrong truck is sent.
2. Navigation is unreliable: open a service (for example Tow) from the landing page, press back, and a different page appears instead of the page the customer came from.

## A. Form structure (same 3 screens, smarter content)

- **Screen 1, the problem:** service already chosen if a tile was tapped (changeable). Then 1 to 4 quick tap questions for that service (chips, large targets, no typing). Then "Add details (optional)": notes and photos.
- **Screen 2, location:** GPS first, pin confirmation, typed address fallback, optional landmark ("near exit 154, northbound"). For Tow, the drop-off destination is asked here too.
- **Screen 3, you and your vehicle:** name, mobile number, optional email; vehicle make, model, color, optional year and plate.
- Required fields are only those marked required below; everything else is optional and never blocks submit.
- Show the market's typical price for the chosen service on screen 1 ("Tows in San Antonio usually cost 135 to 180 USD plus mileage"), from the database.

## B. Questions every request asks

| Field                    | Type                                                                                        | Required                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Are you in a safe place? | Chips: Safe spot (parking lot, driveway) / Road shoulder / In a traffic lane                | Yes. "In a traffic lane" shows a red banner "Call 911 now" with a call button, then lets them continue. |
| When do you need help?   | Chips: Now (default) / Schedule for later (date and time)                                   | Yes (default Now)                                                                                       |
| People with the vehicle  | Number, 0 to 6                                                                              | Optional                                                                                                |
| Notes for the provider   | Text, 500 characters, with hint "Anything that helps: gate code, exact spot, what happened" | Optional                                                                                                |
| Photos                   | Up to 3 (vehicle, damage, location); compressed on device; private storage                  | Optional                                                                                                |

## C. Service-specific questions

**Tow**

| Question                    | Type                                                                                                      | Required |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Where should it go?         | Address or business search, or chips: Nearest repair shop / My home / Decide with provider                | Yes      |
| Vehicle type                | Chips: Car / SUV / Pickup / Van / Motorcycle / RV or heavy                                                | Yes      |
| Does it roll and steer?     | Yes / No / Not sure                                                                                       | Yes      |
| All-wheel or 4-wheel drive? | Yes / No / Not sure (Yes means flatbed needed)                                                            | Optional |
| Was there an accident?      | Yes / No (Yes asks: Have police been called?)                                                             | Yes      |
| Keys with you?              | Yes / No                                                                                                  | Optional |
| Where is it parked?         | Chips: Street / Parking lot / Parking garage (asks height limit) / Ditch or off-road (suggests winch-out) | Optional |
| Riders needing a lift       | Number 0 to 2 (tow trucks have limited seats)                                                             | Optional |

- Show an estimated distance to the destination (straight-line on dummy maps, route distance once Google Maps is on) so providers can include mileage.

**Won't start (jump start)**

| Question                            | Type                                                                 | Required                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| What happens when you turn the key? | Chips: Clicking / Nothing at all / Cranks but won't start / Not sure | Yes                                                                                                                    |
| Electric or hybrid?                 | Yes / No                                                             | Yes (electric shows: "Most EVs can't be jump started; we'll send a tow or mobile charger" and offers to switch to Tow) |
| Want a new battery if needed?       | Yes / No (provider quotes battery separately)                        | Optional                                                                                                               |

**Flat tire**

| Question                  | Type                                                                                     | Required |
| ------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| How many flat tires?      | 1 / 2 or more (2 or more suggests switching to Tow)                                      | Yes      |
| Which tire?               | Front left / Front right / Rear left / Rear right                                        | Optional |
| Do you have a spare?      | Full-size / Small "donut" / No spare / Not sure (No spare suggests Tow or tire delivery) | Yes      |
| Wheel lock key available? | Yes / No / No wheel locks                                                                | Optional |

**Locked out**

| Question                  | Type                                                     | Required                                                                                     |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Where are the keys?       | Locked inside / Lost / Broken in the lock / In the trunk | Yes                                                                                          |
| Is a child or pet inside? | Yes / No                                                 | Yes. Yes shows a red banner "Call 911 now" with a call button, and marks the request urgent. |
| Key type                  | Regular key / Key fob / Push-button start / Not sure     | Optional                                                                                     |

- Notice: "The provider will ask for ID and proof the vehicle is yours (registration or insurance card)."

**Out of gas**

| Question       | Type                                                  | Required                                                 |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Fuel type      | Regular / Premium / Diesel / Electric (out of charge) | Yes. Electric offers to switch to Tow or mobile charger. |
| How much fuel? | 2 gallons (default) / 3 / 5                           | Optional. Show "Fuel is paid separately at pump price."  |

**Stuck or winch-out**

| Question                              | Type                                        | Required |
| ------------------------------------- | ------------------------------------------- | -------- |
| Stuck in                              | Mud / Sand / Snow or ice / Ditch / Other    | Yes      |
| Distance from the road                | Under 10 ft / 10 to 50 ft / More than 50 ft | Yes      |
| Is the vehicle upright on its wheels? | Yes / No (No suggests Tow with recovery)    | Yes      |

## D. Data and providers

- All answers are stored as structured fields per service (JSON schema per service in `packages/core`, validated with Zod on client and server), versioned so questions can change later without breaking old requests.
- The provider offer screen shows the answers as short tags ("Flatbed needed", "Accident", "No spare", "Child inside: urgent") above the price input, plus notes and photos.
- Services, questions, chip labels and which questions are required are editable in **Admin > Business > Services** (add, reorder, hide a question per market). Changes are logged.
- The admin request panel shows the same answers.

## E. Navigation fix (back button, refresh, and returning)

- One flow route with the step in the URL: `/get-help/<service>/problem`, `/get-help/<service>/location`, `/get-help/<service>/details`, then `/r/<request code>`.
- **Back** inside the flow goes to the previous step with all answers kept. Back from the first step returns to **the exact page the customer came from** (home, city page or service page), at the same scroll position. Never to a different page.
- Entering from a tile uses a normal link navigation (one history entry), not a redirect chain. No duplicate history entries when moving between steps; steps use push, corrections within a step use replace.
- Answers are kept on refresh and if the customer leaves and comes back within 2 hours (stored in a draft on the device, plus a server draft once a phone number is entered). Switching service keeps location, vehicle and contact answers.
- The in-page "Back" button and the browser or phone back gesture behave the same.
- After submit, Back from the request page does not reopen the filled form; it goes to the page they started from.
- Prefetch the next step so each step opens instantly.

## Acceptance

- e2e tests for each service: required questions enforced, optional ones skippable, red 911 banners show for "In a traffic lane" and "Child or pet inside", answers appear on the provider offer screen and admin panel.
- e2e navigation tests from home, a city page and a service page: tile → step 1 → Back returns to the same page and scroll; step 3 → Back → Back keeps answers; refresh on step 2 keeps answers; after submit, Back goes to the starting page.
- Screenshots of screen 1 for all six services at 375px, light and dark.
