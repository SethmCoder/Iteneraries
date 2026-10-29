import { describe, expect, it } from "vitest";
import { detectTripConflicts } from "@/lib/itinerary/conflicts";
import type { ItineraryItem, PendingFlight, PendingHotel } from "@/types/database";

function item(partial: Partial<ItineraryItem> & { id: string; title: string }): ItineraryItem {
  return {
    trip_id: "t1",
    created_by: "u1",
    item_type: "place",
    description: null,
    sort_order: 0,
    location_name: null,
    address: null,
    latitude: null,
    longitude: null,
    start_at: null,
    end_at: null,
    timezone: null,
    booking_reference: null,
    source_url: null,
    thumbnail_url: null,
    osm_id: null,
    details: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("detectTripConflicts", () => {
  it("flags overlapping timed activities", () => {
    const conflicts = detectTripConflicts({
      items: [
        item({
          id: "a",
          title: "Museum",
          start_at: "2026-06-01T10:00:00Z",
          end_at: "2026-06-01T12:00:00Z",
        }),
        item({
          id: "b",
          title: "Lunch",
          start_at: "2026-06-01T11:00:00Z",
          end_at: "2026-06-01T13:00:00Z",
        }),
      ],
    });
    expect(conflicts.some((c) => c.id.startsWith("overlap-"))).toBe(true);
  });

  it("flags hotel check-in before flight departure", () => {
    const flight = {
      id: "f1",
      origin: "SFO",
      destination: "NRT",
      depart_date: "2026-06-05",
      return_date: "2026-06-12",
    } as PendingFlight;
    const hotel = {
      id: "h1",
      hotel_name: "Tokyo Inn",
      check_in: "2026-06-03",
      check_out: "2026-06-10",
    } as PendingHotel;
    const conflicts = detectTripConflicts({
      items: [],
      flights: [flight],
      hotels: [hotel],
    });
    expect(conflicts.some((c) => c.id.includes("hotel-before-flight"))).toBe(
      true,
    );
  });

  it("flags busy days", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      item({
        id: `i${i}`,
        title: `Stop ${i}`,
        start_at: `2026-07-01T${10 + i}:00:00Z`,
        end_at: `2026-07-01T${10 + i}:30:00Z`,
      }),
    );
    const conflicts = detectTripConflicts({ items });
    expect(conflicts.some((c) => c.id.startsWith("overload-"))).toBe(true);
  });
});
