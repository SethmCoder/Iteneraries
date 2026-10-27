import type {
  AwardAvailabilityStatus,
  AwardCabin,
  AwardSearch,
  AwardSearchPreferences,
} from "@/types/database";

export type AwardSearchQuery = {
  origin: string;
  destination: string;
  tripType: AwardSearch["trip_type"];
  departDate: string | null;
  departDateEnd: string | null;
  returnDate: string | null;
  returnDateEnd: string | null;
  passengers: number;
  cabin: AwardCabin;
  maxPointsPerPassenger: number | null;
  maxPointsTotal: number | null;
  maxCashFees: number | null;
  preferredProgram: string | null;
  programs: string[];
  preferences: AwardSearchPreferences;
};

export type AwardOption = {
  airline: string | null;
  flightNumbers: string | null;
  originAirport: string;
  destinationAirport: string;
  departAt: string | null;
  arriveAt: string | null;
  timezone: string | null;
  durationMinutes: number | null;
  stops: number;
  cabin: string | null;
  pointsPerPassenger: number | null;
  pointsTotal: number | null;
  taxesFees: number | null;
  currency: string | null;
  loyaltyProgram: string | null;
  bookingUrl: string | null;
  availabilityStatus: AwardAvailabilityStatus;
  provider: string;
  providerResultId: string | null;
  fingerprint: string;
  compromises: string[];
  raw: Record<string, unknown>;
};

export type AwardSearchProviderResult =
  | { ok: true; options: AwardOption[]; provider: string }
  | { ok: false; error: string; setupRequired?: boolean };

export interface AwardSearchProvider {
  id: string;
  search(query: AwardSearchQuery): Promise<AwardSearchProviderResult>;
}

export function cabinToSeatsAero(cabin: AwardCabin): string {
  switch (cabin) {
    case "premium_economy":
      return "premium";
    case "business":
      return "business";
    case "first":
      return "first";
    default:
      return "economy";
  }
}

export function fingerprintAwardOption(parts: {
  provider: string;
  providerResultId?: string | null;
  origin: string;
  destination: string;
  date?: string | null;
  cabin?: string | null;
  program?: string | null;
  points?: number | null;
  flights?: string | null;
}): string {
  return [
    parts.provider,
    parts.providerResultId ?? "",
    parts.origin,
    parts.destination,
    parts.date ?? "",
    parts.cabin ?? "",
    parts.program ?? "",
    parts.points ?? "",
    parts.flights ?? "",
  ].join("|");
}

export function applyPreferenceFilters(
  options: AwardOption[],
  query: AwardSearchQuery,
): AwardOption[] {
  return options
    .map((option) => {
      const compromises = [...option.compromises];
      let keep = true;

      if (
        query.maxPointsPerPassenger != null &&
        option.pointsPerPassenger != null &&
        option.pointsPerPassenger > query.maxPointsPerPassenger
      ) {
        keep = false;
      }
      if (
        query.maxPointsTotal != null &&
        option.pointsTotal != null &&
        option.pointsTotal > query.maxPointsTotal
      ) {
        keep = false;
      }
      if (
        query.maxCashFees != null &&
        option.taxesFees != null &&
        option.taxesFees > query.maxCashFees
      ) {
        keep = false;
      }
      if (
        query.preferences.maxConnections != null &&
        option.stops > query.preferences.maxConnections
      ) {
        keep = false;
      }

      const preferredAirlines = query.preferences.preferredAirlines ?? [];
      if (
        preferredAirlines.length > 0 &&
        option.airline &&
        !preferredAirlines.some(
          (a) =>
            a.toLowerCase() === option.airline!.toLowerCase() ||
            option.flightNumbers?.toUpperCase().startsWith(a.toUpperCase()),
        )
      ) {
        compromises.push("Airline outside preferred list");
      }

      if (
        query.preferences.maxLayoverMinutes != null &&
        option.stops > 0 &&
        option.durationMinutes != null
      ) {
        // Seats.aero cached search often lacks per-layover minutes; flag uncertainty.
        compromises.push("Layover duration not verified against preference");
      }

      if (!query.preferences.mixedCabinOk && option.cabin) {
        const wanted = cabinToSeatsAero(query.cabin);
        if (!option.cabin.toLowerCase().includes(wanted)) {
          compromises.push("Cabin may differ from preferred cabin");
        }
      }

      const departHour = hourFromIso(option.departAt);
      if (
        departHour != null &&
        !inTimeWindow(
          departHour,
          query.preferences.departTimeStart,
          query.preferences.departTimeEnd,
        )
      ) {
        compromises.push("Departure outside preferred time window");
      }

      const arriveHour = hourFromIso(option.arriveAt);
      if (
        arriveHour != null &&
        !inTimeWindow(
          arriveHour,
          query.preferences.arriveTimeStart,
          query.preferences.arriveTimeEnd,
        )
      ) {
        compromises.push("Arrival outside preferred time window");
      }

      return keep
        ? { ...option, compromises: [...new Set(compromises)] }
        : null;
    })
    .filter((o): o is AwardOption => o != null);
}

function hourFromIso(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() + d.getMinutes() / 60;
}

function inTimeWindow(
  hour: number,
  start?: string | null,
  end?: string | null,
): boolean {
  if (!start && !end) return true;
  const s = start ? parseTimeToHour(start) : 0;
  const e = end ? parseTimeToHour(end) : 24;
  if (s == null || e == null) return true;
  if (s <= e) return hour >= s && hour <= e;
  return hour >= s || hour <= e;
}

function parseTimeToHour(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h + min / 60;
}

export function searchFromAwardRow(
  search: AwardSearch,
  programs: string[] = [],
): AwardSearchQuery {
  return {
    origin: search.origin,
    destination: search.destination,
    tripType: search.trip_type,
    departDate: search.depart_date,
    departDateEnd: search.depart_date_end,
    returnDate: search.return_date,
    returnDateEnd: search.return_date_end,
    passengers: search.passengers,
    cabin: search.cabin,
    maxPointsPerPassenger: search.max_points_per_passenger,
    maxPointsTotal: search.max_points_total,
    maxCashFees: search.max_cash_fees,
    preferredProgram: search.preferred_program,
    programs,
    preferences: search.preferences ?? {},
  };
}
