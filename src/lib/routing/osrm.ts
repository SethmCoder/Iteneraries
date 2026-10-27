import {
  getOsrmBaseUrl,
  getOsrmBicycleBaseUrl,
  getOsrmWalkingBaseUrl,
} from "@/lib/env";
import type { RouteRequest, RouteResult, TransportMode } from "@/lib/routing/types";

type OsrmMode = Exclude<TransportMode, "transit">;

const PROFILES: Record<OsrmMode, string> = {
  car: "driving",
  walking: "walking",
  bicycle: "cycling",
};

/**
 * Car-only public demo. Walking/cycling must not use this host — profile in the
 * path is ignored and results would be driving times.
 */
const CAR_ONLY_HOSTS = new Set(["router.project-osrm.org"]);

function baseUrlForMode(mode: OsrmMode): string {
  if (mode === "walking") return getOsrmWalkingBaseUrl().replace(/\/+$/, "");
  if (mode === "bicycle") return getOsrmBicycleBaseUrl().replace(/\/+$/, "");
  return getOsrmBaseUrl().replace(/\/+$/, "");
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === "AbortError");
}

function unavailable(
  mode: TransportMode,
  reason: string,
  manual = true,
): RouteResult {
  return { ok: false, mode, unavailableReason: reason, isManualSuggested: manual };
}

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
};

export async function getOsrmRoute(request: RouteRequest): Promise<RouteResult> {
  const { mode, from, to, signal } = request;
  if (mode === "transit") {
    return unavailable(mode, "Transit routing is not handled by OSRM.");
  }

  if (![from.lat, from.lon, to.lat, to.lon].every(Number.isFinite)) {
    return unavailable(mode, "Origin and destination must have valid coordinates.", false);
  }

  const base = baseUrlForMode(mode);
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return unavailable(mode, "OSRM_BASE_URL is not a valid URL.");
  }
  if (mode !== "car" && CAR_ONLY_HOSTS.has(host)) {
    return unavailable(
      mode,
      `The public OSRM demo server only supports driving. Set OSRM_${mode === "walking" ? "WALKING" : "BICYCLE"}_BASE_URL to a multi-profile host such as routing.openstreetmap.de.`,
    );
  }

  const path = `${PROFILES[mode]}/${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `${base}/route/v1/${path}?overview=full&geometries=geojson&steps=false`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    return unavailable(mode, "The routing service could not be reached.");
  }

  let body: OsrmResponse | null = null;
  try {
    body = (await response.json()) as OsrmResponse;
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    body = null;
  }

  if (body?.code === "NoRoute") {
    return unavailable(mode, "No route found between these locations.");
  }
  if (!response.ok || !body || body.code !== "Ok") {
    return unavailable(
      mode,
      body?.message ?? `Routing service error (status ${response.status}).`,
    );
  }

  const route = body.routes?.[0];
  const line = route?.geometry?.coordinates;
  if (
    !route ||
    typeof route.distance !== "number" ||
    typeof route.duration !== "number" ||
    !Array.isArray(line)
  ) {
    return unavailable(mode, "The routing service returned an unexpected response.");
  }

  return {
    ok: true,
    mode,
    provider: "osrm",
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: line.map(([lon, lat]) => [lat, lon] as [number, number]),
  };
}
