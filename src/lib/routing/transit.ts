import { getTransitRouterUrl } from "@/lib/env";
import type { RouteRequest, RouteResult } from "@/lib/routing/types";

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === "AbortError");
}

function unavailable(reason: string): RouteResult {
  return {
    ok: false,
    mode: "transit",
    unavailableReason: reason,
    isManualSuggested: true,
  };
}

/** Decode a Google-encoded polyline (precision 5) to [lat, lon] pairs. */
export function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  const readValue = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    const dLat = readValue();
    const dLon = readValue();
    if (dLat === null || dLon === null) break;
    lat += dLat;
    lon += dLon;
    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

type OtpLeg = {
  distance?: number;
  legGeometry?: { points?: string };
};

type OtpResponse = {
  plan?: {
    itineraries?: Array<{
      duration?: number;
      legs?: OtpLeg[];
    }>;
  };
  error?: { message?: string; msg?: string };
};

function planUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (/\/plan$/.test(trimmed)) return trimmed;
  if (/\/otp\/routers\/[^/]+$/.test(trimmed)) return `${trimmed}/plan`;
  return `${trimmed}/otp/routers/default/plan`;
}

export async function getTransitRoute(request: RouteRequest): Promise<RouteResult> {
  const { from, to, departAt, signal } = request;
  const base = getTransitRouterUrl();

  if (!base) {
    return unavailable(
      "Train/bus routing needs an OpenTripPlanner server with local GTFS (set TRANSIT_ROUTER_URL). There is no free worldwide transit demo — enter the duration manually for now.",
    );
  }

  let url: URL;
  try {
    url = new URL(planUrl(base));
  } catch {
    return unavailable("TRANSIT_ROUTER_URL is not a valid URL.");
  }

  url.searchParams.set("fromPlace", `${from.lat},${from.lon}`);
  url.searchParams.set("toPlace", `${to.lat},${to.lon}`);
  url.searchParams.set("mode", "TRANSIT,WALK");
  url.searchParams.set("numItineraries", "1");

  const match = departAt?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) {
    url.searchParams.set("date", match[1]);
    url.searchParams.set("time", match[2]);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    return unavailable("The transit routing service could not be reached.");
  }

  let body: OtpResponse | null = null;
  try {
    body = (await response.json()) as OtpResponse;
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    body = null;
  }

  if (!response.ok || !body) {
    return unavailable(`Transit routing service error (status ${response.status}).`);
  }

  const itinerary = body.plan?.itineraries?.[0];
  if (!itinerary || typeof itinerary.duration !== "number") {
    return unavailable(
      body.error?.message ??
        body.error?.msg ??
        "No transit route found between these locations.",
    );
  }

  const legs = itinerary.legs ?? [];
  const distanceMeters = legs.reduce(
    (sum, leg) => sum + (typeof leg.distance === "number" ? leg.distance : 0),
    0,
  );
  const geometry = legs.flatMap((leg) =>
    leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : [],
  );

  return {
    ok: true,
    mode: "transit",
    provider: "transit",
    distanceMeters,
    durationSeconds: itinerary.duration,
    geometry,
  };
}
