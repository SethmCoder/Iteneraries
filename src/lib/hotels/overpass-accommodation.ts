import { getGeocoderUserAgent, getOverpassUrl } from "@/lib/env";
import type { HotelSearchResult } from "@/lib/hotels/types";

/**
 * OpenStreetMap accommodation lookup via Overpass (locations + mapped tags only).
 * Does not provide room rates, availability, or refundability.
 */

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function bookingSearchUrl(name: string, location: string): string {
  const ss = [name, location].filter(Boolean).join(" ").trim();
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(ss)}`;
}

function endpoints(): string[] {
  const primary = getOverpassUrl();
  return [
    primary,
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ].filter((u, i, arr) => arr.indexOf(u) === i);
}

function escapeQl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchOverpassAccommodations(
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<HotelSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const nameFilter = escapeQl(q.slice(0, 64));
  // Bounded name search for tourism lodging — area from nominatim-like worldwide
  // name match; keep query narrow to respect Overpass etiquette.
  const ql = `
[out:json][timeout:18];
(
  node["tourism"~"hotel|motel|hostel|guest_house|apartment"]["name"~"${nameFilter}",i];
  way["tourism"~"hotel|motel|hostel|guest_house|apartment"]["name"~"${nameFilter}",i];
);
out center ${Math.min(40, limit * 2)};
`.trim();

  let lastError: Error | null = null;
  for (const endpoint of endpoints()) {
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
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      const elements = data.elements ?? [];
      const hotels: HotelSearchResult[] = [];
      const seen = new Set<string>();

      for (const el of elements) {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) continue;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const tags = el.tags ?? {};
        const name = (tags.name || tags["name:en"] || "Lodging").trim();
        const city = tags["addr:city"] || tags["addr:town"] || null;
        const country = tags["addr:country"] || null;
        const location = [city, country].filter(Boolean).join(", ") || "OpenStreetMap";
        const id = `overpass-${el.type ?? "n"}-${el.id ?? `${lat},${lon}`}`;
        if (seen.has(id)) continue;
        seen.add(id);
        hotels.push({
          id,
          name,
          location,
          city,
          country,
          displayName: `${name}, ${location}`,
          lat,
          lon,
          averagePriceUsd: null,
          priceLabel: "Rates",
          bookingSearchUrl: bookingSearchUrl(name, location),
          photoUrl: null,
          rating: null,
          source: "openstreetmap",
        });
        if (hotels.length >= limit) break;
      }
      return hotels;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      lastError = e as Error;
    }
  }

  if (lastError) {
    // Soft-fail: caller may already have Nominatim results
    return [];
  }
  return [];
}
