import { getGeocoderUserAgent, getNominatimBaseUrl } from "@/lib/env";

export type GeocodeResult = {
  name: string;
  lat: number;
  lon: number;
  display_name: string;
};

export class NominatimError extends Error {
  readonly status?: number;
  /** Seconds the caller should wait before retrying, when known. */
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

/** Nominatim usage policy: max 1 request per second. */
const MIN_INTERVAL_MS = 1100;
const RESULT_CACHE_TTL_MS = 10 * 60_000;
const RESULT_CACHE_MAX = 200;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
/** If Nominatim returns 429, back off until this timestamp. */
let blockedUntil = 0;

const resultCache = new Map<string, { results: GeocodeResult[]; expiresAt: number }>();

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

/** Serialize requests and enforce the minimum interval between them. */
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

function parseResults(raw: unknown): GeocodeResult[] {
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
    results.push({ name, lat, lon, display_name: displayName });
  }
  return results;
}

export async function searchPlaces(
  query: string,
  options: SearchPlacesOptions = {},
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const limit = Math.max(1, Math.min(20, options.limit ?? 5));
  const cacheKey = [
    q.toLowerCase(),
    limit,
    options.countryCodes?.join(",") ?? "",
    options.acceptLanguage ?? "",
  ].join("|");

  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const url = new URL("/search", getNominatimBaseUrl());
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  if (options.countryCodes?.length) {
    url.searchParams.set("countrycodes", options.countryCodes.join(","));
  }

  const headers: Record<string, string> = {
    "User-Agent": getGeocoderUserAgent(),
    Accept: "application/json",
  };
  if (options.acceptLanguage) headers["Accept-Language"] = options.acceptLanguage;

  const results = await schedule(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: options.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      throw new NominatimError(
        `Geocoding request failed: ${error instanceof Error ? error.message : "network error"}`,
      );
    }

    if (response.status === 429 || response.status === 403) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
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

    try {
      return parseResults(await response.json());
    } catch {
      throw new NominatimError("Geocoding provider returned invalid JSON.");
    }
  }, options.signal);

  resultCache.set(cacheKey, { results, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
  while (resultCache.size > RESULT_CACHE_MAX) {
    const oldest = resultCache.keys().next().value;
    if (oldest === undefined) break;
    resultCache.delete(oldest);
  }
  return results;
}
