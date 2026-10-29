import type { ItineraryItem, PendingFlight, PendingHotel } from "@/types/database";

export type TripConflict = {
  id: string;
  severity: "warning" | "error";
  title: string;
  detail: string;
  relatedIds: string[];
};

function day(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** Detect schedule and booking conflicts from existing trip data (no invented facts). */
export function detectTripConflicts(input: {
  items: ItineraryItem[];
  flights?: PendingFlight[];
  hotels?: PendingHotel[];
}): TripConflict[] {
  const conflicts: TripConflict[] = [];
  const { items, flights = [], hotels = [] } = input;

  // Overlapping timed itinerary items
  const timed = items
    .map((item) => ({
      item,
      start: toMs(item.start_at),
      end: toMs(item.end_at) ?? toMs(item.start_at),
    }))
    .filter((x) => x.start != null)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]!;
      const b = timed[j]!;
      if ((b.start ?? 0) >= (a.end ?? a.start ?? 0)) break;
      conflicts.push({
        id: `overlap-${a.item.id}-${b.item.id}`,
        severity: "warning",
        title: "Overlapping activities",
        detail: `"${a.item.title}" and "${b.item.title}" have overlapping times.`,
        relatedIds: [a.item.id, b.item.id],
      });
    }
  }

  // Hotel stay vs flight depart/return dates
  for (const hotel of hotels) {
    const checkIn = day(hotel.check_in);
    const checkOut = day(hotel.check_out);
    if (checkIn && checkOut && checkOut <= checkIn) {
      conflicts.push({
        id: `hotel-dates-${hotel.id}`,
        severity: "error",
        title: "Invalid hotel dates",
        detail: `${hotel.hotel_name}: check-out must be after check-in.`,
        relatedIds: [hotel.id],
      });
    }
    for (const flight of flights) {
      const depart = day(flight.depart_date);
      const ret = day(flight.return_date);
      if (depart && checkIn && checkIn < depart) {
        conflicts.push({
          id: `hotel-before-flight-${hotel.id}-${flight.id}`,
          severity: "warning",
          title: "Hotel before arrival flight",
          detail: `${hotel.hotel_name} check-in (${checkIn}) is before flight ${flight.origin}→${flight.destination} on ${depart}.`,
          relatedIds: [hotel.id, flight.id],
        });
      }
      if (ret && checkOut && checkOut > ret) {
        conflicts.push({
          id: `hotel-after-return-${hotel.id}-${flight.id}`,
          severity: "warning",
          title: "Hotel after return flight",
          detail: `${hotel.hotel_name} check-out (${checkOut}) is after return flight date ${ret}.`,
          relatedIds: [hotel.id, flight.id],
        });
      }
    }
  }

  // Dense day overload (>6 timed items same calendar day)
  const byDay = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const d = day(item.start_at);
    if (!d) continue;
    const list = byDay.get(d) ?? [];
    list.push(item);
    byDay.set(d, list);
  }
  for (const [d, list] of byDay) {
    if (list.length >= 6) {
      conflicts.push({
        id: `overload-${d}`,
        severity: "warning",
        title: "Busy day",
        detail: `${d} has ${list.length} timed stops — consider spreading activities.`,
        relatedIds: list.map((i) => i.id),
      });
    }
  }

  return conflicts;
}
