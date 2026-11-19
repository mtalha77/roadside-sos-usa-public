# Staging walkthrough (10 minutes)

A guided look at the whole product on staging, in the order a real job happens: the website as a
customer, the admin as the owner and as a dispatcher, then the provider portal as the owner and
as a technician. Each step says exactly which button to press.

Everything on staging runs in **demo mode**: a "Demo data" strip or badge shows on every page,
demo companies end in "(demo)" and demo phone numbers use the 555-01xx range. Real data (requests
sent from Get Help, markets, prices, provider applications) always comes first where it exists.
"Sign in as demo" exists only on staging and preview deployments; production refuses it.

The three addresses are the staging URLs set in Vercel (`NEXT_PUBLIC_WEB_URL`,
`NEXT_PUBLIC_PROVIDER_URL`, `NEXT_PUBLIC_ADMIN_URL`); the admin **Walkthrough** page links to all
three. The admin and the provider portal sit behind Vercel's login on staging.

## 1. Website, as a customer (3 minutes)

1. Open the website on your phone (or a 375 px window). The website leads with online booking:
   above the fold you see the headline ("Book help in under a minute"), six service tiles,
   **Get help now** and the 911 line. Calling is a small "Prefer to call?" link, never the main
   button. Once a city has 10 real bookings, the hero also says how fast help is usually booked
   there.
2. Scroll down: the bottom bar is a full-width **Get help now** with the small call link beside
   it. Under it: no sign-up, how it works, local prices, cities and questions. City, service and
   ad landing pages put the booking button right under the title in the same way.
3. Press **See how it works** (in "How it works"). A 30-second demo plays on its own; **Pause** and
   **Skip demo** work at any time and **Get help now** stays at the bottom the whole time. No tour
   ever starts on its own on the website.
4. Back on the home page, tap the **Flat tire** tile. You land on **Where are you?** ("Step 2 of 3"):
   allow location when the browser asks, or type an address and choose the city. Press
   **Continue**.
5. **Who should the provider look for?**: type a name, a 10-digit number (any 555 number), the car
   make and colour, choose where the car is, tick the consent box and press **Send my request**.
6. The status page ("Finding help") shows how many verified providers serve the city and what to
   do while you wait. This is a real request: it appears in the admin within 2 seconds.
7. **Instant book**: on "Finding help", choose **Book the fastest provider automatically**. "Most
   you'll pay" starts at the city's typical price for the service; change it if you like. The
   first quote at or below it is booked the moment it arrives. With nothing at or below it after
   3 minutes, the page goes back to **Compare quotes** with whatever arrived; you can switch either
   way until a provider is booked. To see it with demo quotes, open a demo request from the admin
   **Walkthrough** (about a third of demo customers use Instant book).

## 2. Admin, as the owner (2 minutes)

1. Open the admin, choose **Sign in as demo**, then **Owner**.
2. The first time, a 6-step tour starts on its own (Today, Team and roles, Markets, Finance,
   search, Take the tour). Press **Next** through it, or **Skip tour**, or **Don't show again**.
   **Take the tour** at the bottom of the menu (behind **Menu** on a phone) restarts it.
3. **Today** is the start page: needs action now with the oldest wait, requests with no quote
   after 3 minutes, providers available (unanswered calls only when phones are enabled), **Booking
   speed** (landing to request submitted, target under 60 s; submitted to provider booked, target
   under 5 minutes; today and the last 7 days, median and 90th percentile, by market and source;
   real data only, **Include demo data** adds labelled demo rows), the 10 most urgent items with
   one action each and a Website or Call tag, today's numbers per market and alerts. The **?**
   button runs a short tour of the page.
4. Open **Team & roles** (System group): every role, who it is for and what it can do. **Invite**
   shows how a new teammate is added (on staging the invite link is shown instead of emailed).
5. Glance at **Markets**, **Pricing** and **Finance** (Business group), then the **System status**
   link. A market's **Launch checklist** requires providers, prices, landing pages, conversion
   tracking and a test booking (a request assigned, then cancelled as "test"); phone numbers and
   the phone schedule are marked optional. **Providers** shows each provider's online status,
   response rate, median quote time and booking rate.
6. **Economics model** (Business group): each market's base and strong inputs from the brief and
   what they mean per month. Change a cost per click and press **Save**: **Analytics** →
   **Model** shows the new numbers at once. **Analytics** opens on **Real** data; **Demo** and
   **Model** are separate views, and every card shows the model's number next to the real one.
   Below the cards: the **Booking funnel** (visits to completed, with drop-off per step),
   **Compare quotes vs Instant book**, **Funnel by** market, source, service or device, the
   **Calls funnel** and **Where people drop** on each Get Help screen with the field touched last.
   **Test campaign** shows the same funnel over the campaign window.

## 3. Admin, as a dispatcher (2 minutes)

1. Press **Sign out** (bottom of the menu), choose **Sign in as demo**, then
   **Dispatcher**. The menu now shows only Today, Inbox, Dispatch board, Requests, Calls and
   Providers; finance, pricing, content, settings and team are refused even by address.
2. **Inbox**: your request from step 1 is there. Open it and press **Claim**, then work through the
   dispatch steps. **Log a call** (top of the Inbox, and on **Calls**) opens phone intake.
3. **Dispatch board**: choose the market at the top. **Real** is the default: press **Demo** (or
   **Both**) to see the demo requests, each tagged Demo. Every card carries a Website or Call tag,
   and Instant book requests show their ceiling ("Instant ≤ $X"). Timers read "45s", "12m 30s", "2h 14m";
   a card turns amber at 3 minutes without a quote and red at 10. Anything with no progress for
   2 hours sits in **Needs closing**.
4. Press **J** to move to the first card and **Enter** to open its side panel; **A** assigns and
   **C** calls. Online booking comes first: **Assign provider** is the main button only on requests
   with no quote after the window or that need closing; on healthy requests it sits under
   **More**. Close the panel with **Escape**.
5. **Demo controls** (bottom of the menu) pause or skip the demo scenario and hold the **load
   test** (about 200 demo requests on the board).
6. **Walkthrough** → **Run full demo** opens one fresh demo job in all three apps side by side.
   The step list (**Quotes arrive**, **Customer picks**, **On the way**, **On site**, **Done and
   review**) and **Skip to the next step** move the admin screens through it.

## 4. Provider portal, as the owner (2 minutes)

1. Open the provider portal, choose **Sign in as demo**, then **Provider owner**.
2. The first time, the owner tour starts: going online, incoming requests, sending a quote, job
   status and the wallet. **Take the tour** (side menu, or **More** on a phone) restarts it.
3. **Home**: turn **Go online** on; incoming requests show on the map. Press **See the next request**.
4. The offer screen fills the whole screen: the countdown ring, the job, a big price box filled
   from your price table (with the fee if you are picked), the arrival chips **15**, **30**,
   **45** and **60 min**, and one **Send quote** button. Decline is a small option below. An
   Instant book offer says "Instant book: accept at $X or less and the job is yours"; a quote at
   or below it is booked at once.
5. **Jobs**, **Wallet**, **Services and prices** and **Team** are in the menu. **Provider
   dispatcher** sees the same without Team.

## 5. Provider portal, as a technician (1 minute)

1. Sign out, choose **Sign in as demo**, then **Technician**.
2. The technician lands on **My jobs**: the active job is the big card at the top (**Open the
   job**), then Active and Done tabs. The top bar has only **My jobs** and the account. The office
   pages (home, offers, wallet, team) send a technician back to My jobs.
3. On the job, the status buttons (On the way, On site, Done) update what the customer sees.

## What is real and what is demo

Requests, markets, prices and fees, provider applications, the call log, tour progress and the
audit log are real database rows. The demo scenario (moving trucks, quotes from demo companies,
the load test, demo providers' supply) is generated from the shared demo clock and never written
to the database. The per-screen list is in `docs/reports/batch-3.md`; batch 4.5 changes are in
`docs/reports/batch-4-5.md`; batch 4.6 changes (booking first, Instant book, analytics) are in
`docs/reports/batch-4-6.md`. Booking funnel events (`funnel_events`) are real rows; the analytics
demo rows are generated and only shown when asked for.
