# Waypoint

Waypoint is a business travel planning web application. Create trips, build chronological itineraries, explore destinations on an interactive OpenStreetMap, collaborate with friends, import reservations from forwarded emails, and request AI-assisted suggestions.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase (Auth, Postgres + RLS, Storage, Realtime) — **free tier**
- Leaflet + OpenStreetMap tiles (free)
- Overpass / Nominatim / FOSSGIS OSRM (free public endpoints; no keys)
- Resend — **free tier** for outbound/inbound email
- AwardWallet Account Access API — **free** for OAuth balance sync
- OpenAI-compatible AI — use a **free** provider (e.g. Groq); paid OpenAI optional
- Seats.aero Partner API — **optional paid**; not required to use the app

## Preview without Supabase

To browse the deployed UI without connecting Supabase, set these on Vercel (or in `.env.local`):

```bash
NEXT_PUBLIC_DEMO_MODE=true
DEMO_PASSWORD=your-preview-password   # optional; blank allows any password
```

Then open `/login` and click **Enter preview**. You’ll get sample Paris trip data; nothing is persisted. Turn this off once real auth is configured.

## What works without credentials

| Area | Status without external accounts |
|---|---|
| UI pages, design system, navigation | Works |
| Demo/preview login | Works when `NEXT_PUBLIC_DEMO_MODE=true` |
| Auth / trip persistence | Requires Supabase |
| Maps + OSM tiles | Works |
| Dynamic POIs (Overpass) | Works when network allows (shared public API; rate-limited) |
| Place name search (Nominatim) | Works when network allows (usage policy applies) |
| Driving routes (OSRM public demo) | Works when network allows |
| Walking/cycling routes | Defaults to FOSSGIS OSRM (`routing.openstreetmap.de`); override with `OSRM_WALKING_BASE_URL` / `OSRM_BICYCLE_BASE_URL` |
| Public transit routing | Requires `TRANSIT_ROUTER_URL` (OpenTripPlanner + regional GTFS; no free global demo) |
| AI Suggest Itinerary | Optional free Groq (or other OpenAI-compatible) key |
| Email import | Optional Resend Free + free AI key for extraction |
| Flights / Hotels Pending | Works; OpenFlights airport + route data (free, bundled) |
| Live award API polling | Optional legacy; not used by Pending UIs |
| Live loyalty sync | Optional legacy AwardWallet OAuth |
| Award monitoring cron | Optional; needs `CRON_SECRET` if enabled |

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill in at least Supabase values for auth/data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL**, **anon key**, and **service role key** into `.env.local`.
3. In the SQL editor, run the single migration:

   - [`supabase/migrations/20241027000000_initial_schema.sql`](supabase/migrations/20241027000000_initial_schema.sql)

4. Confirm Auth email settings (enable/disable email confirmation as desired).
5. Storage bucket `avatars` and RLS policies are created by the initial migration.

Optional CLI:

```bash
npx supabase db push
```

## Environment variables

See [`.env.example`](.env.example) for the full list.

**Required (free):** Supabase URL + anon + service role, `NEXT_PUBLIC_APP_URL`.

**Recommended free:** `CRON_SECRET`, Resend Free (`RESEND_*`), AwardWallet Account Access (`AWARDWALLET_API_KEY`), Groq (or similar) for AI.

**Optional paid (not required):** `SEATS_AERO_API_KEY`, AwardWallet Web Parsing (`AWARDWALLET_WEB_*`).

See [`.env.example`](.env.example) for the full annotated list.

## Account access periods

New accounts get a **30-day** access period (`account_billing`). Users renew for free in **Settings → Account & access**. Reminder emails go out at 7 days and 1 day remaining; after expiry the account is locked, then deleted after a 7-day grace period (`/api/cron/account-lifecycle`).

The billing row is structured for a later paid plan (`plan`, `billing_provider`, Stripe id columns) without rewriting free renew.

## Flights Pending & Hotels Pending

Open **Flights Pending** or **Hotels Pending** from the avatar menu or the trip toolbar (`?tripId=` preselects the trip).

- Assign flights/hotels to a trip and set booking status (`needs_booking`, `in_progress`, `booked`, `skipped`).
- Flights Pending searches airports and known airline routes via bundled [OpenFlights](https://openflights.org) data (`npm run build:openflights` to refresh).
- No paid award or hotel APIs are required.

## Email import (Resend)

1. Verify a domain in Resend and enable inbound.
2. Set `INBOUND_EMAIL_ADDRESS` to your inbound address.
3. Point the Resend webhook to:

   `https://<your-host>/api/webhooks/inbound-email`

4. Set `RESEND_WEBHOOK_SECRET` to the signing secret.
5. Set `OPENAI_API_KEY` so confirmation emails can be parsed.
6. Each user gets an alias token; Settings shows a personalized forward address when configured.

Users review extracted reservations in **Settings** before they are saved to a trip.

## AI suggestions

On an itinerary page, **Suggest Itinerary** calls `/api/ai/suggest`. Suggestions are validated with Zod and never auto-inserted — users add or dismiss each item.

## Maps and POIs

- Itinerary pins stay visible regardless of zoom/pan.
- Discoverable POIs load from Overpass based on viewport + zoom band (`src/lib/poi/zoom-config.ts`).
- Category filters and map search update discoverable pins only.
- OSM attribution is shown on the map.
- Public Overpass/Nominatim/OSRM endpoints are shared infrastructure — configure self-hosted URLs for production load.

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # run production build
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # Vitest unit tests
```

## Testing

Unit tests cover auth validation, POI zoom/cache/dedupe, AI schema validation, email booking-key dedupe, routing unavailable states, rate limiting, and Flight Booker schema/provider helpers.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

End-to-end Playwright flows against a live Supabase project can be added under `e2e/` once credentials are available.

## Deployment

1. Deploy to Vercel (or any Node host supporting Next.js).
2. Set all environment variables in the host.
3. Apply the SQL migration to production Supabase.
4. Configure Resend webhook URL to the production domain.
5. Prefer dedicated Overpass/Nominatim/OSRM instances for production traffic.

## License

Private project — all rights reserved.
