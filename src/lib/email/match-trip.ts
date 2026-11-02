import { z } from "zod";
import { chatJson } from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/env";

export type TripCandidate = {
  id: string;
  name: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Existing itinerary item types on the trip (optional enrichment). */
  item_types?: string[] | null;
  /** Existing itinerary start days YYYY-MM-DD (optional). */
  item_days?: string[] | null;
};

export type ExtractHints = {
  types: string[];
  titles: string[];
  cities: string[];
  airports: string[];
  stations: string[];
  locations: string[];
  eventDays: string[];
  rangeStart: string | null;
  rangeEnd: string | null;
  hotelNames: string[];
  rawReservations: Record<string, unknown>[];
};

export type TripMatchResult = {
  tripId: string | null;
  confidence: number;
  reason: string;
  createTrip?: {
    name: string;
    destination_name: string | null;
    start_date: string | null;
    end_date: string | null;
  };
};

const AIRPORT_CITY: Record<string, string[]> = {
  CDG: ["paris", "france"],
  ORY: ["paris", "france"],
  NRT: ["tokyo", "japan"],
  HND: ["tokyo", "japan"],
  KIX: ["osaka", "japan"],
  LHR: ["london", "uk", "england"],
  LGW: ["london", "uk", "england"],
  JFK: ["new york", "nyc"],
  EWR: ["new york", "nyc"],
  LGA: ["new york", "nyc"],
  SEA: ["seattle"],
  SFO: ["san francisco"],
  LAX: ["los angeles"],
  ORD: ["chicago"],
  BOS: ["boston"],
  MIA: ["miami"],
  DFW: ["dallas"],
  DEN: ["denver"],
  ATL: ["atlanta"],
  ICN: ["seoul", "korea"],
  NCE: ["nice", "france"],
  FCO: ["rome", "italy"],
  AMS: ["amsterdam"],
  FRA: ["frankfurt"],
  MUC: ["munich"],
  ZRH: ["zurich"],
  GVA: ["geneva"],
  BCN: ["barcelona"],
  MAD: ["madrid"],
  LIS: ["lisbon"],
  DUB: ["dublin"],
  SIN: ["singapore"],
  HKG: ["hong kong"],
  SYD: ["sydney"],
  MEL: ["melbourne"],
  YYZ: ["toronto"],
  YVR: ["vancouver"],
};

const TYPE_TO_ITEM: Record<string, string[]> = {
  flight: ["flight"],
  hotel: ["hotel", "lodging"],
  train: ["train", "transit", "transport"],
  restaurant: ["restaurant", "food", "dining"],
  car_rental: ["car", "transport"],
  activity: ["activity", "attraction", "tour"],
  meeting: ["meeting", "business"],
};

function day(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const d = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function overlaps(
  tripStart: string | null,
  tripEnd: string | null,
  eventDay: string | null,
): boolean {
  if (!eventDay || !tripStart) return false;
  const end = tripEnd ?? tripStart;
  return eventDay >= tripStart && eventDay <= end;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function reservationRows(data: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(data.reservations)) {
    return data.reservations.filter(
      (r): r is Record<string, unknown> => Boolean(r) && typeof r === "object",
    );
  }
  if (typeof data.type === "string") return [data];
  return [];
}

export function hintsFromExtracted(data: Record<string, unknown>): ExtractHints {
  const rows = reservationRows(data);
  const types: string[] = [];
  const titles: string[] = [];
  const cities: string[] = [];
  const airports: string[] = [];
  const stations: string[] = [];
  const locations: string[] = [];
  const eventDays: string[] = [];
  const hotelNames: string[] = [];

  for (const row of rows) {
    const type = asString(row.type);
    if (type) types.push(type);

    for (const key of [
      "title",
      "hotelName",
      "restaurantName",
      "airline",
      "provider",
      "operator",
    ] as const) {
      const t = asString(row[key]);
      if (t) titles.push(t);
    }

    const city = asString(row.city);
    if (city) cities.push(city);

    for (const key of ["departureAirport", "arrivalAirport"] as const) {
      const a = asString(row[key]);
      if (a) airports.push(a.toUpperCase());
    }
    for (const key of ["departureStation", "arrivalStation"] as const) {
      const s = asString(row[key]);
      if (s) stations.push(s);
    }
    for (const key of [
      "address",
      "location",
      "pickupLocation",
      "dropoffLocation",
    ] as const) {
      const loc = asString(row[key]);
      if (loc) locations.push(loc);
    }
    const hotel = asString(row.hotelName);
    if (hotel) hotelNames.push(hotel);

    for (const key of [
      "departureTime",
      "arrivalTime",
      "checkIn",
      "checkOut",
      "reservationTime",
      "pickupTime",
      "dropoffTime",
      "startTime",
      "endTime",
    ] as const) {
      const d = day(asString(row[key]));
      if (d) eventDays.push(d);
    }
  }

  const sortedDays = [...new Set(eventDays)].sort();
  return {
    types: [...new Set(types)],
    titles: [...new Set(titles)],
    cities: [...new Set(cities)],
    airports: [...new Set(airports)],
    stations: [...new Set(stations)],
    locations: [...new Set(locations)],
    eventDays: sortedDays,
    rangeStart: sortedDays[0] ?? null,
    rangeEnd: sortedDays[sortedDays.length - 1] ?? null,
    hotelNames: [...new Set(hotelNames)],
    rawReservations: rows,
  };
}

function scoreTrip(trip: TripCandidate, hints: ExtractHints): number {
  let score = 0;
  const dest = `${trip.destination_name ?? ""} ${trip.name ?? ""}`.toLowerCase();

  // Timeline: each overlapping event day scores; range overlap scores higher
  let timelineHits = 0;
  for (const eventDay of hints.eventDays) {
    if (overlaps(trip.start_date, trip.end_date, eventDay)) {
      timelineHits += 1;
      score += 35;
    } else if (trip.start_date && daysBetween(eventDay, trip.start_date) <= 3) {
      score += 10;
    } else if (trip.end_date && daysBetween(eventDay, trip.end_date) <= 3) {
      score += 8;
    }
  }
  if (timelineHits >= 2) score += 20;
  if (
    hints.rangeStart &&
    hints.rangeEnd &&
    trip.start_date &&
    trip.end_date &&
    hints.rangeStart <= trip.end_date &&
    hints.rangeEnd >= trip.start_date
  ) {
    score += 25;
  }

  // Destination / geo
  for (const code of hints.airports) {
    for (const c of AIRPORT_CITY[code] ?? []) {
      if (dest.includes(c)) score += 30;
    }
  }
  for (const city of hints.cities) {
    if (dest.includes(city.toLowerCase())) score += 30;
  }
  for (const loc of [...hints.locations, ...hints.stations, ...hints.hotelNames]) {
    const token = loc.toLowerCase().split(/[,\s]+/).find((t) => t.length > 3);
    if (token && dest.includes(token)) score += 12;
  }

  // Type affinity vs existing itinerary composition
  const itemTypes = (trip.item_types ?? []).map((t) => t.toLowerCase());
  for (const type of hints.types) {
    const aliases = TYPE_TO_ITEM[type] ?? [type];
    if (aliases.some((a) => itemTypes.some((it) => it.includes(a)))) {
      score += 18;
    }
    // Soft prior: flights/hotels often anchor trips
    if (type === "flight" || type === "hotel") score += 5;
  }

  // Cluster with existing item days
  const itemDays = trip.item_days ?? [];
  for (const eventDay of hints.eventDays) {
    if (itemDays.includes(eventDay)) score += 22;
    else if (itemDays.some((d) => daysBetween(d, eventDay) <= 1)) score += 10;
  }

  return score;
}

/**
 * Pick the best trip for an extracted reservation, or propose creating one.
 * Uses timeline + destination + reservation type heuristics, then AI when useful.
 */
export async function matchTripForReservation(input: {
  trips: TripCandidate[];
  extracted: Record<string, unknown>;
  preferTripId?: string | null;
}): Promise<TripMatchResult> {
  if (input.preferTripId) {
    return {
      tripId: input.preferTripId,
      confidence: 1,
      reason: "Matched inbound plus-address trip slug",
    };
  }

  const hints = hintsFromExtracted(input.extracted);
  if (input.trips.length === 0) {
    return buildCreateTrip(hints, "No existing trips");
  }

  const scored = input.trips
    .map((t) => ({ trip: t, score: scoreTrip(t, hints) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const second = scored[1];
  const ambiguous =
    Boolean(second) && best.score > 0 && best.score - (second?.score ?? 0) < 20;
  const shouldAskAi =
    isAiConfigured() &&
    (ambiguous || (best.score >= 15 && best.score < 55) || scored.length > 1);

  if (shouldAskAi) {
    try {
      const pick = await chatJson({
        system: [
          "You assign a travel confirmation email to the best matching itinerary/trip.",
          "Prioritize: (1) reservation dates overlapping the trip window,",
          "(2) destination/city/airport alignment,",
          "(3) reservation type fitting the trip (flight/hotel/restaurant/etc.),",
          "(4) proximity to existing itinerary item dates when provided.",
          "Never invent trip ids. If none fit, return tripId null.",
          "Return JSON { tripId: string|null, reason: string, confidence: number } where confidence is 0..1.",
        ].join(" "),
        user: JSON.stringify({
          reservations: hints.rawReservations,
          timeline: {
            eventDays: hints.eventDays,
            rangeStart: hints.rangeStart,
            rangeEnd: hints.rangeEnd,
            types: hints.types,
          },
          trips: scored.slice(0, 8).map((s) => ({
            id: s.trip.id,
            name: s.trip.name,
            destination: s.trip.destination_name,
            start: s.trip.start_date,
            end: s.trip.end_date,
            itemTypes: s.trip.item_types ?? [],
            itemDays: (s.trip.item_days ?? []).slice(0, 20),
            heuristicScore: s.score,
          })),
        }),
        schema: z.object({
          tripId: z.string().uuid().nullable(),
          reason: z.string(),
          confidence: z.number().min(0).max(1).optional(),
        }),
        temperature: 0,
      });
      if (pick.tripId && input.trips.some((t) => t.id === pick.tripId)) {
        return {
          tripId: pick.tripId,
          confidence: pick.confidence ?? 0.8,
          reason: pick.reason || "AI assigned by timeline and reservation type",
        };
      }
      if (pick.tripId == null && best.score < 25) {
        return buildCreateTrip(
          hints,
          pick.reason || "AI found no matching trip",
        );
      }
    } catch {
      // Fall through to heuristic
    }
  }

  if (best.score >= 40) {
    return {
      tripId: best.trip.id,
      confidence: Math.min(1, best.score / 100),
      reason: `Best timeline/destination/type match (score ${best.score})`,
    };
  }

  if (best.score >= 20) {
    return {
      tripId: best.trip.id,
      confidence: Math.min(0.65, best.score / 100),
      reason: `Likely match (score ${best.score}) — confirm on Forwarded Emails`,
    };
  }

  return buildCreateTrip(hints, "No trip scored high enough");
}

function buildCreateTrip(
  hints: ExtractHints,
  reason: string,
): TripMatchResult {
  const arrival = hints.airports[hints.airports.length - 1] ?? "";
  const cities = AIRPORT_CITY[arrival];
  const destination =
    hints.cities[0] ||
    (cities ? cities[0]!.replace(/^\w/, (c) => c.toUpperCase()) : null) ||
    hints.hotelNames[0] ||
    null;
  return {
    tripId: null,
    confidence: 0,
    reason,
    createTrip: {
      name: destination ? `Trip to ${destination}` : "Imported reservation",
      destination_name: destination,
      start_date: hints.rangeStart,
      end_date: hints.rangeEnd ?? hints.rangeStart,
    },
  };
}
