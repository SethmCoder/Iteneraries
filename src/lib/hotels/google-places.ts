import { getGooglePlacesApiKey } from "@/lib/env";
import type { HotelSearchResult } from "@/lib/hotels/types";

type GooglePlace = {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  priceRange?: {
    startPrice?: { units?: string; currencyCode?: string };
    endPrice?: { units?: string; currencyCode?: string };
  };
  photos?: Array<{ name?: string }>;
  googleMapsUri?: string;
  websiteUri?: string;
  types?: string[];
};

type SearchTextResponse = {
  places?: GooglePlace[];
  error?: { message?: string; status?: string };
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.priceRange",
  "places.photos",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.types",
].join(",");

function priceLevelLabel(level: string | undefined): string | null {
  switch (level) {
    case "PRICE_LEVEL_FREE":
      return "Free";
    case "PRICE_LEVEL_INEXPENSIVE":
      return "$";
    case "PRICE_LEVEL_MODERATE":
      return "$$";
    case "PRICE_LEVEL_EXPENSIVE":
      return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "$$$$";
    default:
      return null;
  }
}

function priceRangeLabel(range: GooglePlace["priceRange"]): string | null {
  const start = range?.startPrice?.units;
  if (!start) return null;
  const currency = range?.startPrice?.currencyCode === "USD" ? "$" : "";
  const end = range?.endPrice?.units;
  if (end && end !== start) return `${currency}${start}–${end}`;
  return `${currency}${start}+`;
}

function googleHotelsSearchUrl(name: string, location: string): string {
  const q = [name, location].filter(Boolean).join(" ").trim();
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(q)}`;
}

function photoProxyUrl(photoName: string | undefined): string | null {
  if (!photoName || !/^places\/[^/]+\/photos\/[^/]+/.test(photoName)) {
    return null;
  }
  return `/api/hotels/photo?name=${encodeURIComponent(photoName)}`;
}

function shortLocation(address: string): {
  location: string;
  city: string | null;
  country: string | null;
} {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { location: address, city: null, country: null };
  }
  const country = parts[parts.length - 1] ?? null;
  const city = parts.length >= 2 ? parts[parts.length - 2]! : null;
  return {
    location: parts.slice(-3).join(", "),
    city,
    country,
  };
}

export function mapGooglePlaceToHotel(place: GooglePlace): HotelSearchResult | null {
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;
  const name = place.displayName?.text?.trim();
  if (!name || lat == null || lon == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const address =
    place.formattedAddress?.trim() ||
    place.shortFormattedAddress?.trim() ||
    "";
  const { location, city, country } = shortLocation(address || name);
  const id = place.id ? `google-${place.id}` : `google-${name}-${lat}-${lon}`;
  const rangeLabel = priceRangeLabel(place.priceRange);
  const levelLabel = priceLevelLabel(place.priceLevel);
  const priceLabel = rangeLabel ?? levelLabel ?? "Rates";
  const photoName = place.photos?.[0]?.name;

  return {
    id,
    name,
    location: address || location,
    city,
    country,
    displayName: address ? `${name}, ${address}` : name,
    lat,
    lon,
    averagePriceUsd: null,
    priceLabel,
    bookingSearchUrl:
      place.googleMapsUri || googleHotelsSearchUrl(name, address || location),
    photoUrl: photoProxyUrl(photoName),
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    source: "google",
    googleMapsUri: place.googleMapsUri ?? null,
  };
}

/**
 * Google Places Text Search (New), filtered to lodging.
 * Closest self-serve API to “Google Hotels” for a free Maps Platform key.
 */
export async function searchGoogleHotels(
  query: string,
  limit = 20,
): Promise<HotelSearchResult[]> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: q,
        includedType: "lodging",
        strictTypeFiltering: true,
        pageSize: Math.min(20, Math.max(1, limit)),
      }),
      cache: "no-store",
    },
  );

  const raw = (await response.json()) as SearchTextResponse;
  if (!response.ok) {
    throw new Error(
      raw.error?.message ||
        `Google Places hotel search failed (${response.status})`,
    );
  }

  const hotels: HotelSearchResult[] = [];
  for (const place of raw.places ?? []) {
    const mapped = mapGooglePlaceToHotel(place);
    if (mapped) hotels.push(mapped);
    if (hotels.length >= limit) break;
  }
  return hotels;
}

/** Fetch photo bytes from Places Photo Media (server-side; keeps key private). */
export async function fetchGoogleHotelPhoto(
  photoName: string,
  maxWidthPx = 320,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) return null;
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) return null;

  const url = new URL(
    `https://places.googleapis.com/v1/${photoName}/media`,
  );
  url.searchParams.set(
    "maxWidthPx",
    String(Math.min(1200, Math.max(1, maxWidthPx))),
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: "image/*" },
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const body = await response.arrayBuffer();
  return { body, contentType };
}
