# RSOS-113: Analytics with correct numbers (economics model, funnel math, real vs demo)

Project: Roadside SOS USA (working name). Repository: github.com/mtalha77/roadside-sos-usa
Copy this file into the repo as `docs/batches/rsos-analytics-fix.md`. Run it right after the current batch finishes (or as the next ticket if a batch is running). Same operating rules as batch 4.6: own branch and pull request into `staging`, CI green, squash-merge yourself, never touch `main`, no questions, secrets never printed. Attach before and after screenshots.

## What is wrong now (owner screenshot, Admin > Analytics, Last 30 days, staging)

1. Demo economics use placeholder assumptions: ad spend 85,462.50 USD against 31,461.52 USD fee revenue, so contribution shows -54,000.98 USD. That is not our model; the real model (below) is positive per accepted lead in both scenarios.
2. Fee revenue does not match the funnel: 2,309 picked requests at our average fee of 32.50 USD would be about 75,000 USD, not 31,461.52 USD.
3. Funnel math is broken: Completed (2,756) is larger than Picked (2,309), shown as 119%. A later step can never exceed an earlier one.
4. Real and demo numbers are mixed on one screen ("Real requests 4" next to demo funnel, demo spend and demo contribution).
5. "Phone" is listed as a source next to ad platforms; source (Google Ads, Meta, Organic, Direct, Referral) and channel (Website, Phone) are different things.
6. "Cost per paid request 37.50 USD" is not derived from the same spend and requests shown.

## Fix

### A. Economics model, editable in the admin

Create **Admin > Business > Economics model** (Owner and Operations manager), stored in the database per market, with history (who changed what, when). Seed it from the owner's brief (Roadside Lead Platform: Structure & Risk Brief, Nov 2026):

| Input                                  | Base                                                        | Strong    | Applies to                        |
| -------------------------------------- | ----------------------------------------------------------- | --------- | --------------------------------- |
| Monthly ad budget                      | 4,000 USD                                                   | 4,000 USD | per market                        |
| Cost per click, San Antonio            | 4.25                                                        | 2.42      | Keyword Planner top-of-page range |
| Cost per click, Las Vegas              | 4.87                                                        | 1.99      | midpoint / low of 1.99 to 7.75    |
| Cost per click, Houston                | 5.95                                                        | 2.70      | midpoint / low of 2.70 to 9.20    |
| Clicks that become a request           | 25%                                                         | 30%       | all markets                       |
| Requests accepted and billable         | 70%                                                         | 80%       | all markets                       |
| Service mix                            | Tow 48%, Jump start 26%, Flat tire 12%, Lockout 8%, Fuel 6% | same      | all markets                       |
| Our fee per service                    | Tow 42.50, Lockout 27.50, Jump start, Flat tire, Fuel 22.50 | same      | weighted average 32.50 USD        |
| Payment fees and disputed-lead credits | 8% of fee revenue                                           | 8%        | all markets                       |
| Subscriptions and featured, net        | 900 USD per month                                           | 900 USD   | per market                        |
| Fixed costs                            | 3,500 USD per month                                         | 3,500 USD | per market                        |

The model calculates and shows (per market and total, base and strong side by side):
clicks = budget ÷ CPC; requests = clicks × click-to-request; accepted = requests × acceptance; fee revenue = accepted × weighted fee; payment fees = 8% of fee revenue; contribution = fee revenue + subscriptions − ad spend − payment fees; profit = contribution − fixed costs; ad cost per accepted request = ad spend ÷ accepted; break-even accepted requests per month.

Expected results with the seeded inputs (unit test must reproduce these, rounded):

| Market      | Scenario | Clicks | Requests | Accepted | Fee revenue | Contribution | Profit after fixed costs | Ad cost per accepted |
| ----------- | -------- | ------ | -------- | -------- | ----------- | ------------ | ------------------------ | -------------------- |
| San Antonio | Base     | 941    | 235      | 165      | 5,353       | 1,825        | -1,675                   | 24.29                |
| San Antonio | Strong   | 1,653  | 496      | 397      | 12,893      | 8,761        | 5,261                    | 10.08                |
| Las Vegas   | Base     | 821    | 205      | 144      | 4,671       | 1,198        | -2,302                   | 27.83                |
| Las Vegas   | Strong   | 2,010  | 603      | 482      | 15,678      | 11,324       | 7,824                    | 8.29                 |
| Houston     | Base     | 672    | 168      | 118      | 3,824       | 418          | -3,082                   | 34.00                |
| Houston     | Strong   | 1,481  | 444      | 356      | 11,556      | 7,531        | 4,031                    | 11.25                |

Fixed costs are shared across markets in reality; show a "Fixed costs shared across markets" toggle that spreads one 3,500 USD across all live markets instead of charging it per market.

### B. Demo data generated from the model, never from placeholders

- Delete the placeholder assumptions in `packages/config` used for demo economics.
- The demo stream generates events whose 30-day totals per market match the **Base** scenario above (within ±5%), with a staging-only switch in Demo controls to use **Strong**.
- Demo spend per day = monthly budget ÷ 30 with small realistic daily variation; demo fees come from the service mix and fee table; demo funnel steps obey the model's rates.
- Today and Last 7 days are proportional to the 30-day totals.

### C. Funnel math rules

- Steps in order: Visits → Started → Submitted → Quoted → Picked (accepted and billable) → Completed.
- Each step's count is always ≤ the previous step. Enforce in the query and in a unit test; if data ever breaks this, show a data warning, never a percentage above 100%.
- Percentages are step-to-step conversion; also show overall conversion from Visits on hover.
- Completed counts only jobs whose request was picked in the same date range (cohort by request date), so completions from older requests do not inflate the range.

### D. Real and demo never mixed

- Analytics shows **Real** data by default in every environment. A clear toggle "Real / Demo / Model" at the top:
  - **Real:** only real events; if there are too few, show the real numbers anyway plus a note "Not enough real data yet".
  - **Demo:** staging only, labelled "Demo data" on every card.
  - **Model:** the expected numbers from the Economics model for the chosen range, labelled "Model estimate".
- Never show a real count and demo money on the same screen.
- Production never has Demo.

### E. Sources and channels

- **Source:** Google Ads, Meta, Microsoft Ads, Organic search, Direct, Referral. **Channel:** Website, Phone (later App).
- "Requests by source" and a separate small "Requests by channel" table. Sources sum to total requests; channels sum to total requests.

### F. Cards at the top (each derived from the same numbers shown below it)

Requests (submitted) · Accepted (picked) · Ad cost per accepted request · Fee revenue · Contribution · Profit after fixed costs. Each card has a small "vs model" line, for example "Model: 24.29 USD" so the owner sees actual against expected. Use green only when better than the model and red only when worse; neutral otherwise.

## Acceptance

- Unit tests reproduce the Expected results table.
- Funnel monotonic test passes; no percentage over 100% possible.
- Screenshot of Analytics in Real, Demo and Model views on staging, Last 30 days, all markets and San Antonio only.
- Economics model page screenshot; changing San Antonio CPC updates Model view numbers immediately.
- Run report entry in `docs/reports/batch-4-6.md` (or `docs/reports/analytics-fix.md` if batch 4.6 is closed).
