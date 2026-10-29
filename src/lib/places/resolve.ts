import { getGeocoderUserAgent, getOverpassUrl } from "@/lib/env";
import { searchPlaces, type GeocodeResult } from "@/lib/geo/nominatim";

export type HoursStatus = "verified" | "unknown";

export type ResolvedPlace = {
  name: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  osmType: string | null;
  osmId: string | null;
  category: string | null;
  openingHoursRaw: string | null;
  hoursStatus: HoursStatus;
  /** Category-based estimate only — never treated as verified visit length. */
  estimatedDurationMinutes: number | null;
  durationIsEstimate: boolean;
  relevance?: string;
  sourceQuery: string;
};

const CATEGORY_DURATION: Record<string, number> = {
  attraction: 90,
  museum: 120,
  restaurant: 75,
  cafe: 45,
  park: 60,
  historic: 90,
  shopping: 60,
  activity: 90,
  other: 60,
};

function scoreMatch(candidate: GeocodeResult, query: string, destination?: string): number {
  const q = query.toLowerCase().trim();
  const name = candidate.name.toLowerCase();
  const display = candidate.display_name.toLowerCase();
  let score = 0;
  if (name === q) score += 100;
  if (name.includes(q) || q.includes(name)) score += 50;
  if (display.includes(q)) score += 20;
  if (destination) {
    const d = destination.toLowerCase();
    if (display.includes(d)) score += 40;
  }
  if (candidate.osm_id) score += 5;
  return score;
}

function guessCategory(name: string, query: string): string {
  const t = `${name} ${query}`.toLowerCase();
  if (/museum|gallery/.test(t)) return "museum";
  if (/restaurant|bistro|brasserie|cafe|café/.test(t)) return "restaurant";
  if (/park|garden/.test(t)) return "park";
  if (/shop|market|mall/.test(t)) return "shopping";
  if (/tower|cathedral|palace|monument|temple|church/.test(t)) return "historic";
  return "attraction";
}

async function fetchOverpassTags(
  osmType: string,
  osmId: string,
  signal?: AbortSignal,
): Promise<Record<string, string> | null> {
  const type =
    osmType === "node" || osmType === "way" || osmType === "relation"
      ? osmType
      : null;
  if (!type || !/^\d+$/.test(osmId)) return null;

  const ql = `[out:json][timeout:12];${type}(${osmId});out tags;`;
  const endpoints = [
    getOverpassUrl(),
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ].filter((u, i, a) => a.indexOf(u) === i);

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": getGeocoderUserAgent(),
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(ql)}`,
        signal,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        elements?: Array<{ tags?: Record<string, string> }>;
      };
      return data.elements?.[0]?.tags ?? null;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
  }
  return null;
}

/**
 * Resolve a must-do / saved place query to a real geocoded location.
 * Opening hours come only from OSM tags when present — never invented.
 */
export async function resolvePlaceQuery(
  query: string,
  options: { destination?: string; signal?: AbortSignal } = {},
): Promise<ResolvedPlace | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const searchQ = options.destination ? `${q}, ${options.destination}` : q;
  const hits = await searchPlaces(searchQ, { limit: 8, signal: options.signal });
  if (!hits.length) return null;

  const ranked = [...hits].sort(
    (a, b) =>
      scoreMatch(b, q, options.destination) -
      scoreMatch(a, q, options.destination),
  );
  const best = ranked[0]!;
  if (scoreMatch(best, q, options.destination) < 20) {
    // Weak match — still return with unknown hours so must-dos are not dropped silently
  }

  let openingHoursRaw: string | null = null;
  let category = guessCategory(best.name, q);
  if (best.osm_type && best.osm_id) {
    const tags = await fetchOverpassTags(best.osm_type, best.osm_id, options.signal);
    if (tags?.opening_hours?.trim()) {
      openingHoursRaw = tags.opening_hours.trim();
    }
    if (tags?.tourism) category = tags.tourism === "museum" ? "museum" : category;
    if (tags?.amenity === "restaurant" || tags?.amenity === "cafe") {
      category = tags.amenity === "cafe" ? "cafe" : "restaurant";
    }
  }

  const estimated = CATEGORY_DURATION[category] ?? 60;

  return {
    name: best.name,
    address: best.display_name,
    lat: best.lat,
    lon: best.lon,
    osmType: best.osm_type ?? null,
    osmId: best.osm_id ?? null,
    category,
    openingHoursRaw,
    hoursStatus: openingHoursRaw ? "verified" : "unknown",
    estimatedDurationMinutes: estimated,
    durationIsEstimate: true,
    sourceQuery: q,
  };
}

export async function resolveMany(
  queries: string[],
  options: { destination?: string; signal?: AbortSignal } = {},
): Promise<ResolvedPlace[]> {
  const out: ResolvedPlace[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    try {
      const resolved = await resolvePlaceQuery(query, options);
      if (!resolved) continue;
      const key =
        resolved.osmId != null
          ? `${resolved.osmType}/${resolved.osmId}`
          : `${resolved.name}|${resolved.lat}|${resolved.lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(resolved);
    } catch {
      // Skip failed lookups; caller can flag unresolved must-dos
    }
  }
  return out;
}

/** Very light OSM opening_hours check for a local HH:mm on a given date. */
export function isLikelyOpenAt(
  openingHoursRaw: string | null,
  dateIso: string,
  timeHm: string,
): boolean | null {
  if (!openingHoursRaw) return null;
  const raw = openingHoursRaw.trim();
  if (/^24\/7$/i.test(raw)) return true;
  // Simple Mo-Su HH:MM-HH:MM pattern
  const m = raw.match(
    /(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)?[\w,\-\s]*?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i,
  );
  if (!m) return null;
  const toMin = (s: string) => {
    const [h, mi] = s.split(":").map(Number);
    return (h ?? 0) * 60 + (mi ?? 0);
  };
  const t = toMin(timeHm);
  const open = toMin(m[1]!);
  const close = toMin(m[2]!);
  if (close <= open) return t >= open || t < close;
  return t >= open && t < close;
  // dateIso reserved for future weekday-aware parsing
  void dateIso;
}
