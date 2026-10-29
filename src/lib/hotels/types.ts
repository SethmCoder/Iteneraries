export type HotelSearchResult = {
  id: string;
  name: string;
  location: string;
  city: string | null;
  country: string | null;
  displayName: string;
  lat: number;
  lon: number;
  /** Average nightly sample from OTAs when enrichment is configured */
  averagePriceUsd: number | null;
  /** Map / list badge text, e.g. "$180", "$$", or "Rates" */
  priceLabel: string;
  bookingSearchUrl: string;
  /** Proxied exterior/listing photo (Google Places) */
  photoUrl?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  source?: "google" | "openstreetmap";
  googleMapsUri?: string | null;
};
