# RSOS Batch 4.5: run report (UX overhaul)

- Run started: 2026-11-18. Spec: `docs/batches/rsos-batch-4-5.md`. Same operating rules as batch 4.
- If context is reset: re-read the batch file, CLAUDE.md and this report, then continue from the
  first ticket not marked Done.

## Summary

| Ticket                                            | Status      | Pull request |
| ------------------------------------------------- | ----------- | ------------ |
| RSOS-100 Emergency-first website home, city pages | In progress |              |
| RSOS-101 Get Help flow, faster and calmer         | Not started |              |
| RSOS-102 Roles and permissions in the admin       | Not started |              |
| RSOS-103 Admin rebuild (Today, navigation, board) | Not started |              |
| RSOS-104 Provider portal polish                   | Not started |              |
| RSOS-105 Skippable guided tours                   | Not started |              |
| RSOS-106 QA pass and walkthrough                  | Not started |              |

## Tickets

### RSOS-100: Emergency-first website home and city pages

- **Above the fold on a 375 x 667 phone**, nothing else:
  - the brand and a small "Call" link with the market's tracking number (only when phones are
    enabled: always outside production, and in production only when Twilio voice is really
    connected);
  - "Stuck on the road? Help is on the way." and one sentence;
  - the real availability line ("N verified providers near {city}") with a "Change city" link,
    hidden without real data;
  - six service tiles in two columns (Tow, Won't start, Flat tire, Locked out, Out of gas, Stuck
    or winch-out), each at least 96px tall, that start the request with that service and land on
    the location step;
  - a full-width "Get help now";
  - "In danger or on a busy highway? Call 911 first."
- **Phone action bar** (Call, Get help now): safe-area aware, hidden while the hero is on screen,
  shown once it scrolls away.
- **Below the fold, in order**: reassurance (no sign-up, no membership, you pay the provider
  directly); how it works with the real quote card and tracking components (a fictional demo
  provider with a realistic arrival time and a real local price; the "Arrival time" placeholder is
  gone); local prices; cities; FAQ; the provider call to action. City pages use the same hero with
  the city's headline.
- **Night mode**: the visitor's saved choice wins; otherwise the system theme; with a light system
  theme the site is dark between 7pm and 6am local time.
- **Less JavaScript**: the theme provider, theme toggle and menu closer were replaced by one small
  inline script (`apps/web/src/lib/site-script.ts`).
- **Demo badge on the website** is now a slim strip at the top of the page: as a fixed corner
  badge it covered the 911 line on phones.
- Tiles show the services enabled in the market (or anywhere, without a market). Winch-out is not
  enabled in any market yet, so five tiles show today; the sixth appears when a market enables it.
- **JavaScript on the home page** (mobile, transferred): 146.9 KB before, about 139 KB after
  (theme provider, toggle and menu closer replaced by an inline script; Vercel Analytics loaded
  only when it is used). The spec's 120 KB target is below what Next.js 16 itself needs: React DOM,
  the router and the runtime are about 137 KB on every page. Reaching 120 KB would mean leaving
  Next.js for the home page, so it is recorded as **partial** for the owner to decide.
- Note: the spec's availability line says "online now". There is no provider presence data yet
  (going online arrives with the provider portal work), so the line shows the real count of
  verified providers serving the market, never invented numbers.
