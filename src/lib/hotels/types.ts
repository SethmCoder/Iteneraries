export type HotelSearchResult = {
  id: string;
  name: string;
  location: string;
  city: string | null;
  country: string | null;
  displayName: string;
  lat: number;
  lon: number;
  /** Reserved; free stack leaves this null and links out for rates */
  averagePriceUsd: number | null;
  /** Map / list badge text, e.g. "Rates" */
  priceLabel: string;
  bookingSearchUrl: string;
  photoUrl?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  source?: "openstreetmap";
};
