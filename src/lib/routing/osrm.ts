import { getOsrmBaseUrl } from "@/lib/env";
import type { RouteRequest, RouteResult, TransportMode } from "@/lib/routing/types";

type OsrmMode = Exclude<TransportMode, "transit">;

const PROFILES: Record<OsrmMode, string> = {
  car: "driving",
  walking: "walking",
  bicycle: "cycling",
};

/**
 * The public OSRM demo server only runs the car profile and ignores the
 * profile in the URL, so walking/cycling results from it would be wrong.
 */
const DEMO_HOSTS = new Set(["router.project-osrm.org"]);

/** Optional per-mode overrides for self-hosted profile servers. */
const MODE_ENV: Record<OsrmMode, string | undefined> = {
  car: undefined,
  walking: "OSRM_WALKING_BASE_URL",
  bicycle: "OSRM_BICYCLE_BASE_URL",
};

function baseUrlForMode(mode: OsrmMode): string {
  const envName = MODE_ENV[mode];
  const override = envName ? process.env[envName] : undefined;
  return (override || getOsrmBaseUrl()).replace(/\/+$/, "");
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
  if (mode !== "car" && DEMO_HOSTS.has(host)) {
    return unavailable(
      mode,
      `The public OSRM demo server only supports driving. Configure a ${mode} OSRM server to enable this mode.`,
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
