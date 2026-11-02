import { describe, expect, it } from "vitest";
import {
  hintsFromExtracted,
  matchTripForReservation,
} from "@/lib/email/match-trip";

describe("hintsFromExtracted", () => {
  it("collects timeline days across reservation types", () => {
    const hints = hintsFromExtracted({
      reservations: [
        {
          type: "flight",
          departureAirport: "SEA",
          arrivalAirport: "CDG",
          departureTime: "2026-10-15T10:00",
        },
        {
          type: "hotel",
          hotelName: "Hotel Paris",
          checkIn: "2026-10-15",
          checkOut: "2026-10-18",
          city: "Paris",
        },
        {
          type: "restaurant",
          restaurantName: "Chez Lui",
          reservationTime: "2026-10-16T19:30",
        },
      ],
    });
    expect(hints.types).toEqual(
      expect.arrayContaining(["flight", "hotel", "restaurant"]),
    );
    expect(hints.eventDays).toEqual(
      expect.arrayContaining(["2026-10-15", "2026-10-16", "2026-10-18"]),
    );
    expect(hints.rangeStart).toBe("2026-10-15");
    expect(hints.cities).toContain("Paris");
  });
});

describe("matchTripForReservation enriched scoring", () => {
  it("prefers the trip whose window and item days match restaurant + hotel", async () => {
    const result = await matchTripForReservation({
      trips: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Paris client week",
          destination_name: "Paris, France",
          start_date: "2026-10-14",
          end_date: "2026-10-19",
          item_types: ["flight", "hotel"],
          item_days: ["2026-10-15", "2026-10-16"],
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Tokyo",
          destination_name: "Tokyo, Japan",
          start_date: "2026-12-01",
          end_date: "2026-12-08",
          item_types: ["flight"],
          item_days: ["2026-12-02"],
        },
      ],
      extracted: {
        reservations: [
          {
            type: "hotel",
            hotelName: "Hotel Lutetia",
            city: "Paris",
            checkIn: "2026-10-15",
            checkOut: "2026-10-18",
          },
          {
            type: "restaurant",
            restaurantName: "Septime",
            reservationTime: "2026-10-16T20:00",
          },
        ],
      },
    });
    expect(result.tripId).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.confidence).toBeGreaterThan(0.3);
  });
});
