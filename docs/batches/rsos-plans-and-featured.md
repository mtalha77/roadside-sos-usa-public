# RSOS-114: Provider plans and Featured placement (self-explaining, admin-priced)

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy this file into the repo as `docs/batches/rsos-plans-and-featured.md`. Run after RSOS-113. Same operating rules as batch 4.6: own branch and pull request into `staging`, CI green, squash-merge yourself, never touch `main`, no questions, secrets never printed. Attach before and after screenshots.

Payments (Stripe Billing, wallet top-ups) come in batch 6. In this ticket, build the full plans experience, the admin catalog and all rules; checkout is behind a feature flag and uses a fake billing adapter. Switching on real billing later must need only Stripe keys and the flag.

---

## The plans (default values, all editable in the admin)

|                      | **Basic**                                                                                  | **Pro**                                                                                | **Featured** (add-on)                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Price                | 20 USD per month (minimum; there is no free plan)                                          | 129 USD per month                                                                      | 37.50 USD per month, per market                                                               |
| What you pay per job | Our flat fee per job you win (Tow 42.50, Lockout 27.50, Jump start, Flat tire, Fuel 22.50) | Same fees **15% off**                                                                  | No change to fees                                                                             |
| Who it is for        | New or part-time providers                                                                 | Busy providers who win 10+ jobs a month                                                | Providers who want more visibility in one city                                                |
| Offers               | All requests in your service area                                                          | All requests, plus **first look: 15 seconds before others** on requests in your area   | Your quote shows at the top with a "Featured" label when it meets the price and arrival rules |
| Profile              | Standard profile                                                                           | **Pro badge** on your profile and quotes                                               | "Featured" label and top spot on the city page provider list                                  |
| Team                 | Up to 2 technicians                                                                        | Unlimited technicians and office dispatchers                                           | No change                                                                                     |
| Insights             | Basic: jobs, earnings, acceptance rate                                                     | Full: win rate by service and area, price comparison with nearby providers, best hours | No change                                                                                     |
| Wallet               | Manual top-up                                                                              | Auto top-up                                                                            | No change                                                                                     |
| Commitment           | None                                                                                       | Monthly, cancel anytime                                                                | Monthly, cancel anytime                                                                       |

**Break-even line for Pro**, shown to the provider: "Pro pays for itself at about N jobs a month", where N = (Pro price − Basic price) ÷ (average fee × 15%), calculated live from their own service mix. With the defaults (129 − 20 = 109 USD) and a 32.50 USD average fee, N ≈ 23 jobs. Show their own last-30-day job count beside it ("You won 34 jobs last month: Pro would have saved you about 57 USD after the higher plan price").

**No free plan.** Every provider must be on a paid plan (Basic at minimum) to receive requests. An account without an active plan can complete onboarding and verification but receives no offers. Optional: an admin-controlled first-month offer per market (for example the first month of Basic at 0 USD or a discount) for early recruitment, off by default, with an end date.

## Rules

**Fees**

- The fee is charged only when the customer picks the provider (or Instant book books them), taken from the wallet before numbers are shared (RSOS-038).
- Cancelled before the provider starts, or disputed and approved: the fee returns as wallet credit.
- Pro discount applies automatically to every fee while the plan is active.

**Pro first look**

- On a new request, Pro providers in range get the offer immediately; others get it 15 seconds later (admin-editable, 0 to 30 seconds).
- First look never applies to Instant book offers above the customer's price limit.
- If there are no Pro providers in range, everyone gets the offer at once.

**Featured placement (in-platform ads)**

- Bought per market, optionally per service.
- Limited slots per market (default 3; admin-editable) so the list stays fair; when full, new buyers join a waitlist.
- In the customer's quote list, a Featured quote is shown at the top only if it is within 15% of the cheapest quote and within 10 minutes of the fastest arrival (both admin-editable). Otherwise it appears in its normal position. Customers always get a fair deal.
- At most one Featured quote at the top of any list. If several qualify, rotate fairly (lowest price first, then fastest).
- Always labelled **"Featured"** with an info tooltip: "This provider pays to be shown first. Prices and arrival times are their real quote." (Required for clear advertising disclosure.)
- Featured providers also appear first on the city page provider list, with the same label.
- Featured reporting for the provider: times shown at top, quotes picked while featured, cost per picked job from Featured.

**Changing plans**

- Upgrade: starts immediately, billed pro rata.
- Downgrade or cancel: stays active until the end of the paid month.
- Price changes in the admin apply to **new subscribers immediately** and to **existing subscribers from their next billing date**, with an email notice at least 30 days before (notice period admin-editable). Existing subscribers can be kept on their old price ("grandfathered") with one checkbox.

---

## Provider-facing screens (provider portal and public "For providers" page)

1. **Public "For providers" pricing page:** the three columns above in plain language, a fee table per service for the chosen city, the Pro break-even line, an FAQ ("When am I charged?", "What if the customer cancels?", "What does Featured mean for customers?", "Can I cancel anytime?"), and "Start with Basic, 20 USD a month" as the main button (shows the first-month offer when one is active).
2. **Portal > Plan & billing:** current plan, what it includes, this month's fees and savings, the personal break-even line, upgrade and cancel buttons, Featured slots available per market with a "Join waitlist" button when full.
3. **In context hints (not pushy):** on the earnings screen, "Pro would have saved you X USD last month"; on a lost quote that went to a Featured provider, no hint (never make providers feel cheated).
4. Every price shown comes from the admin catalog, never hardcoded.

## Admin screens (Owner and Operations manager; Finance can view)

**Admin > Business > Plans & pricing**

- Plan catalog: name, monthly price, fee discount %, first-look seconds, technician limit, insights level, auto top-up allowed, active or hidden, display order, description bullets (editable text shown to providers).
- Per-market overrides: different Pro or Featured price per market.
- Fee table per service per market (already exists in Pricing; link both ways).
- Featured settings per market: slots, price, price rule (within X% of cheapest), arrival rule (within Y minutes of fastest), service-level slots on or off.
- Price change: set a new price with an effective date, choose "apply to existing subscribers at next billing" or "grandfather existing", preview who is affected and the notice email, then confirm. Logged in the audit log.
- Subscribers list: provider, plan, market, start date, price paid, status, MRR. Totals: Pro count, Featured count per market, monthly recurring revenue.

**Economics model link:** subscription and Featured revenue in the Economics model (RSOS-113) come from real subscriber counts when present, otherwise from the model inputs.

## Analytics

- Plan mix and MRR over time; Pro conversion rate from Basic; churn.
- Featured: fill rate per market, picks while featured, customer pick rate of Featured vs non-Featured quotes (to prove fairness).

## Acceptance

- Unit tests: no offers sent to providers without an active plan, fee discount, break-even calculation, first-look timing, Featured eligibility rules, rotation, price change effective dates and grandfathering.
- e2e: provider views pricing page, starts Pro (fake billing), sees discounted fee on the next job; admin changes the Pro price with grandfathering and the provider still pays the old price; Featured quote shown at top only when within the rules.
- Screenshots: public pricing page (375px and 1440px), Portal Plan & billing, Admin Plans & pricing, a customer quote list with a Featured quote.
