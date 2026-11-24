# Runbook: Google Maps keys (RSOS-021b)

> **Switched off by the owner (batch 4 scope change).** Every app uses the dummy maps adapter: the
> placeholder map (our tokens, pins from coordinates), typed addresses checked for format only (no
> autocomplete, no geocoding), browser GPS stored as coordinates, straight-line distance and an
> ETA from `MAPS_AVG_SPEED_MPH` (default 30). `/api/places` answers 404. The Google adapter stays
> in `packages/core/src/adapters/maps.ts`, unit tested against mocks. **To switch it on later:**
> add the keys below in Vercel and set `MAPS_ENABLED=true` for that environment, then redeploy.
> No code change. Interactive maps never load on marketing or city pages either way.

Two keys, both in the same Google Cloud project, both **restricted**. Values go only into Vercel
environment variables; never into the repository, chat or logs.

| Variable                          | Where it runs                                 | Restriction                               | APIs allowed                                     |
| --------------------------------- | --------------------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser (rsos-web, rsos-provider, rsos-admin) | Websites (HTTP referrers)                 | Maps JavaScript API only                         |
| `GOOGLE_MAPS_SERVER_KEY`          | Server only (route handlers, server actions)  | API restriction (Vercel has no fixed IPs) | Places API (New), Geocoding API, Routes API      |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | Browser (optional)                            | n/a (a Map ID, not a key)                 | Needed for Advanced Markers (else `DEMO_MAP_ID`) |

Address autocomplete runs on our server (`/api/places`) with the server key, so the browser key
does not need the Places API.

## Browser key: allowed referrers

Add `https://roadrescuesos.com/*` and `https://*.roadrescuesos.com/*` (every production and staging
host), plus the patterns below (`example.com` stands for the domain in `packages/config/src/brand.ts`):

- Production: `https://example.com/*`, `https://www.example.com/*`, `https://pro.example.com/*`,
  `https://admin.example.com/*`
- Staging: `https://staging.example.com/*`, `https://staging-pro.example.com/*`,
  `https://staging-admin.example.com/*`
- Vercel previews: `https://rsos-web-*.vercel.app/*`, `https://rsos-provider-*.vercel.app/*`,
  `https://rsos-admin-*.vercel.app/*`
- Local development (better: a separate dev key): `http://localhost:3000/*`,
  `http://localhost:3001/*`, `http://localhost:3002/*`

## Steps for the owner

1. Google Cloud console > APIs & Services > Library: enable **Maps JavaScript API**, **Places API
   (New)**, **Geocoding API** and **Routes API**.
2. Credentials > Create credentials > API key (browser key). Application restrictions: Websites,
   with the referrers above. API restrictions: Maps JavaScript API.
3. Create a second API key (server key). API restrictions: Places API (New), Geocoding API,
   Routes API.
4. Optional: Google Maps Platform > Map management > Create Map ID (JavaScript, vector). One ID
   serves light and dark; the app sets the colour scheme itself.
5. Billing > Budgets & alerts: a monthly budget with email alerts at 50%, 90% and 100%.
6. In Vercel, for rsos-web, rsos-provider and rsos-admin, add for Preview (staging branch) and
   Production: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, and optionally
   `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Redeploy.
7. Check Admin > Settings > System status: **Google Maps** shows **Real** for all three apps.

## Usage guard

Every real Maps call is counted per day in `api_usage` (autocomplete, place, geocode, routes).
Admin > Settings > System status shows today's counts. When the Maps total passes the daily
threshold (default 2,000, editable by super admins there), the team inbox gets one email that day.
Twilio Verify is counted the same way (default threshold 300).

## Without keys

Previews, tests and demo mode use the fake adapter: the schematic map, one echoed address
suggestion at the city centre, no reverse geocoding, and straight-line route estimates. Nothing is
sent to Google.
