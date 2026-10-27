import { getSeatsAeroApiKey } from "@/lib/env";
import {
  applyPreferenceFilters,
  cabinToSeatsAero,
  fingerprintAwardOption,
  type AwardOption,
  type AwardSearchProvider,
  type AwardSearchProviderResult,
  type AwardSearchQuery,
} from "@/lib/flights/provider";

const BASE = "https://seats.aero/partnerapi";

type SeatsAvailability = {
  ID?: string;
  Date?: string;
  Source?: string;
  Route?: {
    OriginAirport?: string;
    DestinationAirport?: string;
  };
  YAvailable?: boolean;
  WAvailable?: boolean;
  JAvailable?: boolean;
  FAvailable?: boolean;
  YMileageCost?: string | number;
  WMileageCost?: string | number;
  JMileageCost?: string | number;
  FMileageCost?: string | number;
  YRemainingSeats?: number;
  WRemainingSeats?: number;
  JRemainingSeats?: number;
  FRemainingSeats?: number;
  YAirlines?: string;
  WAirlines?: string;
  JAirlines?: string;
  FAirlines?: string;
  YDirect?: boolean;
  WDirect?: boolean;
  JDirect?: boolean;
  FDirect?: boolean;
  YTaxes?: string | number;
  WTaxes?: string | number;
  JTaxes?: string | number;
  FTaxes?: string | number;
  ComputedLastSeen?: string;
  TotalDuration?: number;
};

type SeatsSearchResponse = {
  data?: SeatsAvailability[];
  cursor?: number;
  count?: number;
  error?: string;
  message?: string;
};

function parseMiles(value: string | number | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function cabinFields(
  row: SeatsAvailability,
  cabin: AwardSearchQuery["cabin"],
): {
  available: boolean;
  miles: number | null;
  seats: number | null;
  airlines: string | null;
  direct: boolean | null;
  taxes: number | null;
  label: string;
} {
  const key =
    cabin === "premium_economy"
      ? "W"
      : cabin === "business"
        ? "J"
        : cabin === "first"
          ? "F"
          : "Y";
  const available = Boolean(row[`${key}Available` as keyof SeatsAvailability]);
  return {
    available,
    miles: parseMiles(row[`${key}MileageCost` as keyof SeatsAvailability] as string | number),
    seats: (row[`${key}RemainingSeats` as keyof SeatsAvailability] as number) ?? null,
    airlines: (row[`${key}Airlines` as keyof SeatsAvailability] as string) ?? null,
    direct: (row[`${key}Direct` as keyof SeatsAvailability] as boolean) ?? null,
    taxes: parseMiles(row[`${key}Taxes` as keyof SeatsAvailability] as string | number),
    label:
      cabin === "premium_economy"
        ? "premium_economy"
        : cabin === "business"
          ? "business"
          : cabin === "first"
            ? "first"
            : "economy",
  };
}

export function mapSeatsAeroRow(
  row: SeatsAvailability,
  query: AwardSearchQuery,
): AwardOption | null {
  const cabin = cabinFields(row, query.cabin);
  if (!cabin.available && cabin.miles == null) return null;

  const origin = row.Route?.OriginAirport ?? query.origin;
  const destination = row.Route?.DestinationAirport ?? query.destination;
  const program = row.Source ?? query.preferredProgram ?? null;
  const points = cabin.miles;
  const pointsTotal =
    points != null ? points * query.passengers : null;
  const stops = cabin.direct === true ? 0 : cabin.direct === false ? 1 : 0;
  const departAt = row.Date ? `${row.Date}T12:00:00Z` : null;
  const bookingUrl = `https://seats.aero/?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(row.Date ?? "")}&source=${encodeURIComponent(program ?? "")}`;

  const availabilityStatus =
    row.ComputedLastSeen || cabin.seats != null ? "estimated" : "unverified";

  return {
    airline: cabin.airlines?.split(",")[0]?.trim() || null,
    flightNumbers: null,
    originAirport: origin,
    destinationAirport: destination,
    departAt,
    arriveAt: null,
    timezone: null,
    durationMinutes: row.TotalDuration ?? null,
    stops,
    cabin: cabin.label,
    pointsPerPassenger: points,
    pointsTotal,
    taxesFees: cabin.taxes,
    currency: "USD",
    loyaltyProgram: program,
    bookingUrl,
    availabilityStatus,
    provider: "seats_aero",
    providerResultId: row.ID ?? null,
    fingerprint: fingerprintAwardOption({
      provider: "seats_aero",
      providerResultId: row.ID,
      origin,
      destination,
      date: row.Date,
      cabin: cabin.label,
      program,
      points,
      flights: cabin.airlines,
    }),
    compromises: [],
    raw: row as Record<string, unknown>,
  };
}

export async function searchSeatsAero(
  query: AwardSearchQuery,
): Promise<AwardSearchProviderResult> {
  const apiKey = getSeatsAeroApiKey();
  if (!apiKey) {
    return {
      ok: false,
      setupRequired: true,
      error:
        "Award search requires SEATS_AERO_API_KEY. Add a Seats.aero Partner API key to enable live award inventory.",
    };
  }

  const origin = query.origin.trim().toUpperCase();
  const destination = query.destination.trim().toUpperCase();
  if (origin.length < 3 || destination.length < 3) {
    return { ok: false, error: "Origin and destination airport codes are required." };
  }

  const url = new URL(`${BASE}/search`);
  url.searchParams.set("origin_airport", origin);
  url.searchParams.set("destination_airport", destination);
  if (query.departDate) url.searchParams.set("start_date", query.departDate);
  if (query.departDateEnd || query.departDate) {
    url.searchParams.set(
      "end_date",
      query.departDateEnd || query.departDate || "",
    );
  }
  url.searchParams.set("cabins", cabinToSeatsAero(query.cabin));
  url.searchParams.set("take", "50");
  url.searchParams.set("order_by", "lowest_mileage");

  const sources = [
    ...query.programs,
    ...(query.preferredProgram ? [query.preferredProgram] : []),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (sources.length) {
    url.searchParams.set("sources", [...new Set(sources)].join(","));
  }
  if (query.preferences.maxConnections === 0) {
    url.searchParams.set("only_direct_flights", "true");
  }
  const carriers = query.preferences.preferredAirlines ?? [];
  if (carriers.length) {
    url.searchParams.set("carriers", carriers.join(","));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Partner-Authorization": apiKey,
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach Seats.aero. Try again later." };
  }

  let body: SeatsSearchResponse | null = null;
  try {
    body = (await response.json()) as SeatsSearchResponse;
  } catch {
    body = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error:
        body?.error ||
        body?.message ||
        `Seats.aero error (status ${response.status}).`,
    };
  }

  const rows = Array.isArray(body?.data) ? body!.data! : [];
  const mapped = rows
    .map((row) => mapSeatsAeroRow(row, query))
    .filter((o): o is AwardOption => o != null);

  return {
    ok: true,
    provider: "seats_aero",
    options: applyPreferenceFilters(mapped, query),
  };
}

export const seatsAeroProvider: AwardSearchProvider = {
  id: "seats_aero",
  search: searchSeatsAero,
};

export async function getAwardProvider(): Promise<AwardSearchProvider> {
  return seatsAeroProvider;
}
