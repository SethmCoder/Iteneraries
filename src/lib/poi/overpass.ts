import { getGeocoderUserAgent, getOverpassUrl } from "@/lib/env";
import { dedupePlaces } from "@/lib/poi/dedupe";
import type {
  OsmElementType,
  PoiCategory,
  PoiPlace,
  ViewportBounds,
} from "@/lib/poi/types";
import { CATEGORY_TAGS, matchCategory } from "@/lib/poi/zoom-config";

export class OverpassError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "OverpassError";
    this.status = status;
  }
}

export type FetchPoisParams = ViewportBounds & {
  categories: readonly PoiCategory[];
  limit: number;
  signal?: AbortSignal;
  /** Only fetch features that have a wikidata tag (major sights). */
  majorOnly?: boolean;
  /** Server-side Overpass timeout in seconds. Defaults to 25. */
  timeoutSeconds?: number;
};

export type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function escapeQlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function assertBounds({ south, west, north, east }: ViewportBounds): void {
  const values = [south, west, north, east];
  if (!values.every((v) => Number.isFinite(v))) {
    throw new OverpassError("Invalid bounds: values must be finite numbers.");
  }
  if (south >= north) {
    throw new OverpassError("Invalid bounds: south must be less than north.");
  }
  if (west >= east) {
    throw new OverpassError("Invalid bounds: west must be less than east.");
  }
  if (south < -90 || north > 90 || west < -180 || east > 180) {
    throw new OverpassError("Invalid bounds: coordinates out of range.");
  }
}

/** Build Overpass QL that selects named nodes and ways for the given categories. */
export function buildOverpassQuery(params: FetchPoisParams): string {
  const { south, west, north, east, categories, limit, majorOnly } = params;
  const timeout = Math.max(5, Math.min(60, params.timeoutSeconds ?? 25));
  const bbox = `(${south},${west},${north},${east})`;
  const extra = majorOnly ? '["wikidata"]' : "";

  const statements: string[] = [];
  for (const category of categories) {
    for (const filter of CATEGORY_TAGS[category]) {
      const pattern = filter.values.map(escapeQlString).join("|");
      const selector = `["${filter.key}"~"^(${pattern})$"]["name"]${extra}`;
      statements.push(`  node${selector}${bbox};`);
      statements.push(`  way${selector}${bbox};`);
    }
  }

  // `out center N` is valid; `out center tags N` is rejected by some mirrors (HTTP 406).
  const safeLimit = Math.max(1, Math.min(300, Math.floor(limit)));
  return [
    `[out:json][timeout:${timeout}];`,
    "(",
    ...statements,
    ");",
    `out center ${safeLimit};`,
  ].join("\n");
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const city = tags["addr:city"];
  const postcode = tags["addr:postcode"];

  const line1 = [number, street].filter(Boolean).join(" ");
  const line2 = [postcode, city].filter(Boolean).join(" ");
  const full = [line1, line2].filter((part) => part.length > 0).join(", ");
  if (full) return full;
  return tags["addr:full"] || undefined;
}

function isOsmType(value: unknown): value is OsmElementType {
  return value === "node" || value === "way" || value === "relation";
}

/**
 * Convert raw Overpass elements to PoiPlaces. Elements missing a name, an id,
 * usable coordinates, or a matching category are skipped (nothing is invented).
 */
export function parseOverpassElements(
  elements: readonly OverpassElement[],
  categories: readonly PoiCategory[],
): PoiPlace[] {
  const places: PoiPlace[] = [];

  for (const element of elements) {
    if (!isOsmType(element.type)) continue;
    if (typeof element.id !== "number" || !Number.isFinite(element.id)) continue;

    const tags = element.tags;
    if (!tags) continue;
    const name = tags.name?.trim();
    if (!name) continue;

    const lat = element.type === "node" ? element.lat : element.center?.lat;
    const lon = element.type === "node" ? element.lon : element.center?.lon;
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const category = matchCategory(tags, categories);
    if (!category) continue;

    const place: PoiPlace = {
      osmType: element.type,
      osmId: element.id,
      name,
      category,
      lat,
      lon,
      tags,
    };
    const address = buildAddress(tags);
    if (address) place.address = address;
    places.push(place);
  }

  return dedupePlaces(places);
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === "AbortError");
}

function overpassEndpoints(): string[] {
  const primary = getOverpassUrl();
  const mirrors = [
    primary,
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];
  return [...new Set(mirrors)];
}

async function postOverpassQuery(
  endpoint: string,
  query: string,
  signal?: AbortSignal,
): Promise<Response> {
  // Prefer raw QL body — form-urlencoded + Accept: application/json can 406 on some mirrors.
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": getGeocoderUserAgent(),
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
    cache: "no-store",
  });
}

export async function fetchPoisFromOverpass(
  params: FetchPoisParams,
): Promise<PoiPlace[]> {
  const { categories, signal } = params;
  if (categories.length === 0) return [];
  assertBounds(params);
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }

  const query = buildOverpassQuery(params);
  let lastError: OverpassError | null = null;

  for (const endpoint of overpassEndpoints()) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    let response: Response;
    try {
      response = await postOverpassQuery(endpoint, query, signal);
    } catch (error) {
      if (isAbort(error, signal)) throw error;
      lastError = new OverpassError(
        `Overpass request failed: ${error instanceof Error ? error.message : "network error"}`,
      );
      continue;
    }

    if (!response.ok) {
      lastError = new OverpassError(
        response.status === 429
          ? "Overpass is rate limiting requests. Try again shortly."
          : `Overpass responded with status ${response.status}.`,
        response.status,
      );
      // Try the next mirror on client / server errors that often mean a bad mirror.
      if ([406, 504, 502, 429, 403].includes(response.status)) continue;
      throw lastError;
    }

    let json: { elements?: OverpassElement[]; remark?: string };
    try {
      json = (await response.json()) as typeof json;
    } catch (error) {
      if (isAbort(error, signal)) throw error;
      lastError = new OverpassError("Overpass returned an invalid JSON response.");
      continue;
    }

    const elements = Array.isArray(json.elements) ? json.elements : [];
    if (
      json.remark &&
      /error|timed out|out of memory/i.test(json.remark) &&
      elements.length === 0
    ) {
      lastError = new OverpassError(`Overpass query failed: ${json.remark}`);
      continue;
    }

    return parseOverpassElements(elements, categories);
  }

  throw (
    lastError ??
    new OverpassError("Overpass request failed on all configured endpoints.")
  );
}
