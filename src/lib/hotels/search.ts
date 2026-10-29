import {
  getGeocoderUserAgent,
  getMakcorpsJwt,
  getNominatimBaseUrl,
  isGoogleHotelsConfigured,
} from "@/lib/env";
import { searchGoogleHotels } from "@/lib/hotels/google-places";
import { searchOverpassAccommodations } from "@/lib/hotels/overpass-accommodation";
import type { HotelSearchResult } from "@/lib/hotels/types";

export type { HotelSearchResult } from "@/lib/hotels/types";

type NominatimHotelRow = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  class?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    county?: string;
    state?: string;
    country?: string;
    tourism?: string;
    hotel?: string;
  };
};

function bookingSearchUrl(name: string, location: string): string {
  const ss = [name, location].filter(Boolean).join(" ").trim();
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(ss)}`;
}

function googleHotelsUrl(name: string, location: string): string {
  const q = [name, location].filter(Boolean).join(" ").trim();
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(q)}`;
}

function shortLocation(row: NominatimHotelRow): {
  location: string;
  city: string | null;
  country: string | null;
} {
  const a = row.address ?? {};
  const city =
    a.city || a.town || a.village || a.municipality || a.suburb || a.county || null;
  const country = a.country || null;
  const parts = [city, a.state, country].filter(Boolean);
  if (parts.length) {
    return { location: parts.join(", "), city, country };
  }
  const display = row.display_name ?? "";
  const bits = display.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    location: bits.slice(1, 4).join(", ") || display,
    city: bits[1] ?? null,
    country: bits[bits.length - 1] ?? null,
  };
}

function isHotelLike(row: NominatimHotelRow, query: string): boolean {
  const cls = (row.class ?? "").toLowerCase();
  const typ = (row.type ?? "").toLowerCase();
  if (cls === "tourism" && (typ === "hotel" || typ === "motel" || typ === "hostel" || typ === "guest_house")) {
    return true;
  }
  if (typ === "hotel" || typ === "motel") return true;
  const name = (row.name ?? row.display_name ?? "").toLowerCase();
  const q = query.toLowerCase();
  if (name.includes("hotel") || name.includes("inn") || name.includes("resort")) {
    return true;
  }
  // Brand query match (e.g. "Villa Fontaine") even if OSM type is incomplete
  return q.length >= 3 && name.includes(q);
}

function normalizeName(row: NominatimHotelRow): string {
  if (row.name?.trim()) return row.name.trim();
  const display = row.display_name ?? "";
  return display.split(",")[0]?.trim() || "Hotel";
}

function scoreHotel(row: NominatimHotelRow, query: string): number {
  const name = normalizeName(row).toLowerCase();
  const q = query.trim().toLowerCase();
  let score = 0;
  if (name === q) score += 100;
  if (name.includes(q)) score += 50;
  if ((row.class === "tourism" && row.type === "hotel") || row.type === "hotel") {
    score += 30;
  }
  if (name.startsWith(q)) score += 20;
  return score;
}

async function fetchNominatimHotels(
  query: string,
  limit: number,
): Promise<NominatimHotelRow[]> {
  const q = query.trim();
  const url = new URL("/search", getNominatimBaseUrl());
  // Prefer hotel matches; Nominatim special-phrase "hotel" helps ranking
  const searchQ = /\bhotel\b/i.test(q) ? q : `${q} hotel`;
  url.searchParams.set("q", searchQ);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(Math.min(30, Math.max(limit * 2, 12))));

  const response = await fetch(url, {
    headers: {
      "User-Agent": getGeocoderUserAgent(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Hotel search failed (${response.status})`);
  }

  const raw = (await response.json()) as NominatimHotelRow[];
  if (!Array.isArray(raw)) return [];
  return raw;
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = nb.split(" ").filter((t) => t.length > 2);
  let hits = 0;
  for (const t of tb) if (ta.has(t)) hits += 1;
  return hits >= 2;
}

type CityPriceSample = { hotelName: string; avg: number };

async function fetchCityPriceSamples(city: string): Promise<CityPriceSample[]> {
  const jwt = getMakcorpsJwt();
  if (!jwt || !city.trim()) return [];

  const slug = encodeURIComponent(city.trim().toLowerCase().split(",")[0]!.trim());
  const url = `https://api.makcorps.com/free/${slug}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `JWT ${jwt}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const raw = (await response.json()) as unknown;
    if (!Array.isArray(raw)) return [];

    const samples: CityPriceSample[] = [];
    for (const entry of raw) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const meta = entry[0] as { hotelName?: string };
      const vendors = entry[1] as Array<Record<string, string | null>>;
      if (!meta?.hotelName || !Array.isArray(vendors)) continue;
      const prices: number[] = [];
      for (const v of vendors) {
        for (const [key, val] of Object.entries(v)) {
          if (!key.startsWith("price") || val == null) continue;
          const n = Number(String(val).replace(/[^0-9.]/g, ""));
          if (Number.isFinite(n) && n > 0) prices.push(n);
        }
      }
      if (!prices.length) continue;
      const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
      samples.push({ hotelName: meta.hotelName, avg });
    }
    return samples;
  } catch {
    return [];
  }
}

async function enrichPrices(
  hotels: HotelSearchResult[],
): Promise<HotelSearchResult[]> {
  if (!getMakcorpsJwt() || hotels.length === 0) return hotels;

  const cities = [
    ...new Set(
      hotels
        .map((h) => h.city)
        .filter((c): c is string => Boolean(c)),
    ),
  ].slice(0, 4);

  const byCity = new Map<string, CityPriceSample[]>();
  await Promise.all(
    cities.map(async (city) => {
      byCity.set(city.toLowerCase(), await fetchCityPriceSamples(city));
    }),
  );

  return hotels.map((h) => {
    const samples = h.city ? byCity.get(h.city.toLowerCase()) ?? [] : [];
    const match = samples.find((s) => fuzzyNameMatch(s.hotelName, h.name));
    if (!match) return h;
    return {
      ...h,
      averagePriceUsd: match.avg,
      priceLabel: `$${match.avg}`,
    };
  });
}

/**
 * Search hotels by brand or name.
 * Prefers Google Places lodging Text Search when GOOGLE_PLACES_API_KEY is set
 * (photos, ratings, price level, map coords). Falls back to OpenStreetMap.
 */
export async function searchHotels(
  query: string,
  limit = 20,
): Promise<HotelSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (isGoogleHotelsConfigured()) {
    try {
      const googleHits = await searchGoogleHotels(q, limit);
      if (googleHits.length > 0) return googleHits;
    } catch {
      // Fall through to Nominatim
    }
  }

  const raw = await fetchNominatimHotels(q, limit);
  const filtered = raw
    .filter((row) => isHotelLike(row, q))
    .sort((a, b) => scoreHotel(b, q) - scoreHotel(a, q));

  const seen = new Set<string>();
  const hotels: HotelSearchResult[] = [];

  for (const row of filtered) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = normalizeName(row);
    const { location, city, country } = shortLocation(row);
    const id =
      row.place_id != null
        ? `osm-${row.place_id}`
        : `${row.osm_type ?? "x"}-${row.osm_id ?? `${lat},${lon}`}`;
    if (seen.has(id)) continue;
    seen.add(id);

    hotels.push({
      id,
      name,
      location,
      city,
      country,
      displayName: row.display_name ?? `${name}, ${location}`,
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

  // If OSM returned nothing hotel-like, fall back to unfiltered top hits
  if (hotels.length === 0) {
    for (const row of raw.slice(0, limit)) {
      const lat = Number(row.lat);
      const lon = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const name = normalizeName(row);
      const { location, city, country } = shortLocation(row);
      hotels.push({
        id: `osm-${row.place_id ?? `${lat},${lon}`}`,
        name,
        location,
        city,
        country,
        displayName: row.display_name ?? `${name}, ${location}`,
        lat,
        lon,
        averagePriceUsd: null,
        priceLabel: "Rates",
        bookingSearchUrl: bookingSearchUrl(name, location),
        photoUrl: null,
        rating: null,
        source: "openstreetmap",
      });
    }
  }

  // Optional Overpass lodging fill when Nominatim is thin (locations only; no rates)
  if (hotels.length < Math.min(5, limit)) {
    try {
      const extra = await searchOverpassAccommodations(q, limit);
      for (const h of extra) {
        const dedupe = `${h.name.toLowerCase()}|${h.lat.toFixed(3)}|${h.lon.toFixed(3)}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        hotels.push(h);
        if (hotels.length >= limit) break;
      }
    } catch {
      // Keep Nominatim results; Overpass is optional
    }
  }

  const enriched = await enrichPrices(hotels);
  // Attach Google Hotels as alternate when no numeric price (used by UI links)
  return enriched.map((h) =>
    h.averagePriceUsd == null
      ? {
          ...h,
          // Keep Booking as primary; Google is discoverable via same ss query style
          bookingSearchUrl: h.bookingSearchUrl || googleHotelsUrl(h.name, h.location),
        }
      : h,
  );
}
