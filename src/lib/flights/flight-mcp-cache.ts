/**
 * Flight MCP Open Cache — anonymous, no API key.
 * @see https://flight-mcp.com/guides/flight-search-api-without-api-key
 *
 * Limits: 10 directed routes, 1 adult economy USD, weekly refresh, max 20 offers.
 */

export const FLIGHT_MCP_SUPPORTED_ROUTES = [
  "JFK→LHR",
  "LAX→JFK",
  "SFO→JFK",
  "LAX→SYD",
  "HND→LAX",
  "ICN→NRT",
  "HKG→SIN",
  "SIN→SYD",
  "LHR→CDG",
  "FRA→JFK",
] as const;

const SUPPORTED_PAIRS = new Set(
  FLIGHT_MCP_SUPPORTED_ROUTES.map((r) => r.replace("→", "|")),
);

export type FlightMcpOffer = {
  id: string;
  airline: string | null;
  flightNumber: string | null;
  origin: string;
  destination: string;
  departureAt: string | null;
  arrivalAt: string | null;
  durationMinutes: number | null;
  stops: number | null;
  price: number | null;
  currency: string;
  bookingUrl: string | null;
  staleLabel: string;
};

export type FlightMcpSearchResult =
  | { ok: true; offers: FlightMcpOffer[]; cached: true }
  | {
      ok: false;
      code: "UNSUPPORTED_ROUTE" | "CACHE_MISS" | "ERROR";
      message: string;
    };

function isSupported(origin: string, destination: string): boolean {
  return SUPPORTED_PAIRS.has(`${origin}|${destination}`);
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function mapOffer(
  raw: Record<string, unknown>,
  index: number,
  origin: string,
  destination: string,
): FlightMcpOffer {
  const priceObj =
    raw.price && typeof raw.price === "object"
      ? (raw.price as Record<string, unknown>)
      : null;
  return {
    id: pickString(raw.id, raw.offerId) ?? `mcp-${index}`,
    airline: pickString(raw.airline, raw.carrier, raw.validatingCarrier),
    flightNumber: pickString(raw.flightNumber, raw.flight_number),
    origin: pickString(raw.origin, raw.from) ?? origin,
    destination: pickString(raw.destination, raw.to) ?? destination,
    departureAt: pickString(
      raw.departureAt,
      raw.departure_at,
      raw.departureDateTime,
      raw.departAt,
    ),
    arrivalAt: pickString(
      raw.arrivalAt,
      raw.arrival_at,
      raw.arrivalDateTime,
      raw.arriveAt,
    ),
    durationMinutes: pickNumber(
      raw.durationMinutes,
      raw.duration_minutes,
      raw.totalDuration,
    ),
    stops: pickNumber(raw.stops, raw.stopCount),
    price: pickNumber(raw.price, priceObj?.amount, priceObj?.total, raw.total),
    currency:
      pickString(raw.currency, priceObj?.currency) ?? "USD",
    bookingUrl: pickString(
      raw.bookingUrl,
      raw.booking_url,
      raw.deepLink,
      raw.url,
    ),
    staleLabel: "Cached offer (Open Cache · up to 7 days old)",
  };
}

export async function searchFlightMcpCache(input: {
  origin: string;
  destination: string;
  departureDate: string;
  maxResults?: number;
}): Promise<FlightMcpSearchResult> {
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();
  if (!isSupported(origin, destination)) {
    return {
      ok: false,
      code: "UNSUPPORTED_ROUTE",
      message: `Open Cache only covers: ${FLIGHT_MCP_SUPPORTED_ROUTES.join(", ")}. This pair has no anonymous cached fares.`,
    };
  }

  try {
    const response = await fetch(
      "https://flight-mcp.com/v1/flights/search/cached",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          departureDate: input.departureDate,
          maxResults: Math.min(20, input.maxResults ?? 10),
          cacheTtlSeconds: 604800,
        }),
        cache: "no-store",
      },
    );

    if (response.status === 404) {
      return {
        ok: false,
        code: "CACHE_MISS",
        message:
          "No suitable cached flight data for this date. Open Cache refreshes weekly and only stores prior searches — try another date in the next 180 days.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        code: "ERROR",
        message: `Flight cache unavailable (${response.status}). Try again later.`,
      };
    }

    const json = (await response.json()) as {
      offers?: unknown[];
      data?: unknown[];
    };
    const rawOffers = Array.isArray(json.offers)
      ? json.offers
      : Array.isArray(json.data)
        ? json.data
        : [];

    const offers = rawOffers
      .filter((o): o is Record<string, unknown> => typeof o === "object" && o != null)
      .map((o, i) => mapOffer(o, i, origin, destination));

    if (offers.length === 0) {
      return {
        ok: false,
        code: "CACHE_MISS",
        message: "Cache returned no offers for this search.",
      };
    }

    return { ok: true, offers, cached: true };
  } catch {
    return {
      ok: false,
      code: "ERROR",
      message: "Could not reach Flight MCP Open Cache.",
    };
  }
}
