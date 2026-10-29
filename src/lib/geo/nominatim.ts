import { getGeocoderUserAgent, getNominatimBaseUrl } from "@/lib/env";

export type GeocodeResult = {
  name: string;
  lat: number;
  lon: number;
  display_name: string;
  osm_type?: string | null;
  osm_id?: string | null;
};

export class NominatimError extends Error {
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  constructor(message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "NominatimError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type SearchPlacesOptions = {
  limit?: number;
  signal?: AbortSignal;
  countryCodes?: string[];
  acceptLanguage?: string;
};

const MIN_INTERVAL_MS = 1100;
const RESULT_CACHE_TTL_MS = 10 * 60_000;
const RESULT_CACHE_MAX = 200;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
let blockedUntil = 0;

const resultCache = new Map<
  string,
  { results: GeocodeResult[]; expiresAt: number }
>();

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const run = async (): Promise<T> => {
    if (signal?.aborted) throw abortError(signal);
    const now = Date.now();
    if (now < blockedUntil) {
      throw new NominatimError(
        "Geocoding is temporarily rate limited. Please try again shortly.",
        429,
        Math.ceil((blockedUntil - now) / 1000),
      );
    }
    const wait = lastRequestAt + MIN_INTERVAL_MS - now;
    if (wait > 0) await sleep(wait, signal);
    lastRequestAt = Date.now();
    return task();
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

function parseNominatimResults(raw: unknown): GeocodeResult[] {
  if (!Array.isArray(raw)) return [];
  const results: GeocodeResult[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    const displayName =
      typeof row.display_name === "string" ? row.display_name : "";
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !displayName) continue;
    const name =
      typeof row.name === "string" && row.name.trim()
        ? row.name.trim()
        : displayName.split(",")[0].trim();
    const osmType =
      typeof row.osm_type === "string" ? row.osm_type.toLowerCase() : null;
    const osmId =
      row.osm_id != null && String(row.osm_id).length
        ? String(row.osm_id)
        : null;
    results.push({
      name,
      lat,
      lon,
      display_name: displayName,
      osm_type: osmType,
      osm_id: osmId,
    });
  }
  return results;
}

function parsePhotonResults(raw: unknown): GeocodeResult[] {
  if (typeof raw !== "object" || raw === null) return [];
  const features = (raw as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const results: GeocodeResult[] = [];
  for (const feature of features) {
    if (typeof feature !== "object" || feature === null) continue;
    const geometry = (feature as { geometry?: { coordinates?: unknown } })
      .geometry;
    const props = (feature as { properties?: Record<string, unknown> })
      .properties;
    const coords = geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2 || !props) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name =
      typeof props.name === "string" && props.name.trim()
        ? props.name.trim()
        : typeof props.street === "string"
          ? props.street
          : "";
    const parts = [
      name,
      typeof props.city === "string" ? props.city : null,
      typeof props.state === "string" ? props.state : null,
      typeof props.country === "string" ? props.country : null,
    ].filter(Boolean);
    const display_name = parts.join(", ");
    if (!display_name) continue;
    results.push({
      name: name || display_name.split(",")[0],
      lat,
      lon,
      display_name,
    });
  }
  return results;
}

async function searchNominatim(
  q: string,
  limit: number,
  options: SearchPlacesOptions,
): Promise<GeocodeResult[]> {
  const url = new URL("/search", getNominatimBaseUrl());
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", String(limit));
  if (options.countryCodes?.length) {
    url.searchParams.set("countrycodes", options.countryCodes.join(","));
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": getGeocoderUserAgent(),
      Accept: "application/json",
    },
    signal: options.signal,
    cache: "no-store",
  });

  if (response.status === 429 || response.status === 403) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const seconds =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
    blockedUntil = Date.now() + seconds * 1000;
    throw new NominatimError(
      "Geocoding is rate limited by the provider. Please try again shortly.",
      response.status,
      seconds,
    );
  }
  if (!response.ok) {
    throw new NominatimError(
      `Geocoding provider responded with status ${response.status}.`,
      response.status,
    );
  }

  return parseNominatimResults(await response.json());
}

async function searchPhoton(
  q: string,
  limit: number,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": getGeocoderUserAgent(),
      Accept: "application/json",
    },
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new NominatimError(
      `Backup geocoder responded with status ${response.status}.`,
      response.status,
    );
  }

  return parsePhotonResults(await response.json());
}

export async function searchPlaces(
  query: string,
  options: SearchPlacesOptions = {},
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const limit = Math.max(1, Math.min(20, options.limit ?? 8));
  const cacheKey = [
    q.toLowerCase(),
    limit,
    options.countryCodes?.join(",") ?? "",
    options.acceptLanguage ?? "",
  ].join("|");

  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const results = await schedule(async () => {
    try {
      const primary = await searchNominatim(q, limit, options);
      if (primary.length > 0) return primary;
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      // Fall through to Photon.
    }

    try {
      return await searchPhoton(q, limit, options.signal);
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      throw new NominatimError(
        error instanceof Error
          ? error.message
          : "Place search is temporarily unavailable.",
      );
    }
  }, options.signal);

  resultCache.set(cacheKey, {
    results,
    expiresAt: Date.now() + RESULT_CACHE_TTL_MS,
  });
  while (resultCache.size > RESULT_CACHE_MAX) {
    const oldest = resultCache.keys().next().value;
    if (oldest === undefined) break;
    resultCache.delete(oldest);
  }
  return results;
}
