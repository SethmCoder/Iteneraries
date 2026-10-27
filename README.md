# Waypoint

Waypoint is a business travel planning web application. Create trips, build chronological itineraries, explore destinations on an interactive OpenStreetMap, collaborate with friends, import reservations from forwarded emails, and request AI-assisted suggestions.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase (Auth, Postgres + RLS, Storage, Realtime)
- Leaflet + OpenStreetMap tiles
- Overpass API for dynamic points of interest
- Nominatim geocoding
- OSRM routing (optional OpenTripPlanner for transit)
- OpenAI-compatible API for suggestions and email extraction
- Resend inbound email webhooks

## What works without credentials

| Area | Status without external accounts |
|---|---|
| UI pages, design system, navigation | Works |
| Auth / trip persistence | Requires Supabase |
| Maps + OSM tiles | Works |
| Dynamic POIs (Overpass) | Works when network allows (shared public API; rate-limited) |
| Place name search (Nominatim) | Works when network allows (usage policy applies) |
| Driving routes (OSRM public demo) | Works when network allows |
| Walking/cycling routes | Need `OSRM_WALKING_BASE_URL` / `OSRM_BICYCLE_BASE_URL` (public demo is driving-only) |
| Public transit routing | Requires `TRANSIT_ROUTER_URL` |
| AI Suggest Itinerary | Requires `OPENAI_API_KEY` |
| Email import | Requires Resend inbound + webhook secret + AI key |

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
3. In the SQL editor, run the migration file:

   [`supabase/migrations/20241027000000_initial_schema.sql`](supabase/migrations/20241027000000_initial_schema.sql)

4. Confirm Auth email settings (enable/disable email confirmation as desired).
5. Storage bucket `avatars` and RLS policies are created by the migration.

Optional CLI:

```bash
npx supabase db push
```

## Environment variables

See [`.env.example`](.env.example) for the full list.

Required for core app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to the browser)

Optional integrations:

- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_ADDRESS`
- `OVERPASS_API_URL`, `OSRM_BASE_URL`, `OSRM_WALKING_BASE_URL`, `OSRM_BICYCLE_BASE_URL`, `TRANSIT_ROUTER_URL`
- `NOMINATIM_BASE_URL`, `GEOCODER_USER_AGENT`
- `NEXT_PUBLIC_APP_URL`

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

Unit tests cover auth validation, POI zoom/cache/dedupe, AI schema validation, email booking-key dedupe, routing unavailable states, and rate limiting.

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
