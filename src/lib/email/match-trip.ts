import { z } from "zod";
import { chatJson } from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/env";

export type TripCandidate = {
  id: string;
  name: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type ExtractHints = {
  type?: string;
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hotelName?: string | null;
  city?: string | null;
  title?: string | null;
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
  JFK: ["new york", "nyc"],
  SEA: ["seattle"],
  SFO: ["san francisco"],
  LAX: ["los angeles"],
};

function day(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
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

function scoreTrip(trip: TripCandidate, hints: ExtractHints): number {
  let score = 0;
  const eventDay =
    day(hints.departureTime) ||
    day(hints.checkIn) ||
    day(hints.arrivalTime) ||
    day(hints.checkOut);

  if (overlaps(trip.start_date, trip.end_date, eventDay)) score += 50;
  else if (eventDay && trip.start_date) {
    const dist = Math.abs(
      Date.parse(eventDay) - Date.parse(trip.start_date),
    );
    if (dist < 3 * 86_400_000) score += 15;
  }

  const dest = (trip.destination_name ?? trip.name ?? "").toLowerCase();
  const arrival = (hints.arrivalAirport ?? "").toUpperCase();
  const cities = AIRPORT_CITY[arrival] ?? [];
  for (const c of cities) {
    if (dest.includes(c)) score += 40;
  }
  if (hints.city && dest.includes(hints.city.toLowerCase())) score += 35;
  if (hints.hotelName && dest.includes(hints.hotelName.toLowerCase().slice(0, 4))) {
    score += 10;
  }

  return score;
}

function hintsFromExtracted(data: Record<string, unknown>): ExtractHints {
  const nested = Array.isArray(data.reservations)
    ? (data.reservations[0] as Record<string, unknown> | undefined)
    : data;
  const row = nested ?? data;
  return {
    type: typeof row.type === "string" ? row.type : undefined,
    departureAirport:
      typeof row.departureAirport === "string" ? row.departureAirport : null,
    arrivalAirport:
      typeof row.arrivalAirport === "string" ? row.arrivalAirport : null,
    departureTime:
      typeof row.departureTime === "string" ? row.departureTime : null,
    arrivalTime: typeof row.arrivalTime === "string" ? row.arrivalTime : null,
    checkIn: typeof row.checkIn === "string" ? row.checkIn : null,
    checkOut: typeof row.checkOut === "string" ? row.checkOut : null,
    hotelName: typeof row.hotelName === "string" ? row.hotelName : null,
    city: typeof row.city === "string" ? row.city : null,
    title: typeof row.title === "string" ? row.title : null,
  };
}

/**
 * Pick the best trip for an extracted reservation, or propose creating one.
 * Example: SEA→CDG on Oct 15 prefers Paris Oct 15–19 over Japan Dec.
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
    second && best.score > 0 && best.score - second.score < 15;

  if (ambiguous && isAiConfigured()) {
    try {
      const pick = await chatJson({
        system:
          "You assign a travel reservation to the best matching trip. Prefer overlapping dates and destination cities/airports. Never invent trips. Return JSON { tripId: string|null, reason: string }.",
        user: JSON.stringify({
          reservation: hints,
          trips: scored.slice(0, 5).map((s) => ({
            id: s.trip.id,
            name: s.trip.name,
            destination: s.trip.destination_name,
            start: s.trip.start_date,
            end: s.trip.end_date,
            heuristicScore: s.score,
          })),
        }),
        schema: z.object({
          tripId: z.string().uuid().nullable(),
          reason: z.string(),
        }),
        temperature: 0,
      });
      if (pick.tripId && input.trips.some((t) => t.id === pick.tripId)) {
        return {
          tripId: pick.tripId,
          confidence: 0.75,
          reason: pick.reason || "AI trip assignment",
        };
      }
    } catch {
      // Fall through to heuristic
    }
  }

  if (best.score >= 40) {
    return {
      tripId: best.trip.id,
      confidence: Math.min(1, best.score / 100),
      reason: `Best date/destination match (score ${best.score})`,
    };
  }

  if (best.score >= 20) {
    return {
      tripId: best.trip.id,
      confidence: Math.min(0.6, best.score / 100),
      reason: `Likely match (score ${best.score}) — confirm on Forwarded Emails`,
    };
  }

  return buildCreateTrip(hints, "No trip scored high enough");
}

function buildCreateTrip(
  hints: ExtractHints,
  reason: string,
): TripMatchResult {
  const arrival = (hints.arrivalAirport ?? "").toUpperCase();
  const cities = AIRPORT_CITY[arrival];
  const destination =
    hints.city ||
    (cities ? cities[0]!.replace(/^\w/, (c) => c.toUpperCase()) : null) ||
    hints.hotelName ||
    null;
  const start =
    day(hints.departureTime) || day(hints.checkIn) || day(hints.arrivalTime);
  const end = day(hints.checkOut) || day(hints.arrivalTime) || start;
  return {
    tripId: null,
    confidence: 0,
    reason,
    createTrip: {
      name: destination ? `Trip to ${destination}` : "Imported reservation",
      destination_name: destination,
      start_date: start,
      end_date: end,
    },
  };
}

export { hintsFromExtracted };
