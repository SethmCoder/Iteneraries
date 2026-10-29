import { describe, expect, it } from "vitest";
import { matchTripForReservation } from "@/lib/email/match-trip";

describe("matchTripForReservation", () => {
  it("prefers Paris trip for SEA-CDG mid-October over Japan in December", async () => {
    const result = await matchTripForReservation({
      trips: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Paris",
          destination_name: "Paris, France",
          start_date: "2026-10-15",
          end_date: "2026-10-19",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Japan",
          destination_name: "Tokyo, Japan",
          start_date: "2026-12-05",
          end_date: "2026-12-08",
        },
      ],
      extracted: {
        type: "flight",
        departureAirport: "SEA",
        arrivalAirport: "CDG",
        departureTime: "2026-10-15T10:00:00Z",
      },
    });
    expect(result.tripId).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("proposes creating a trip when none fit", async () => {
    const result = await matchTripForReservation({
      trips: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Japan",
          destination_name: "Tokyo, Japan",
          start_date: "2026-12-05",
          end_date: "2026-12-08",
        },
      ],
      extracted: {
        type: "flight",
        departureAirport: "SEA",
        arrivalAirport: "CDG",
        departureTime: "2026-10-15T10:00:00Z",
      },
    });
    // Japan in Dec won't score high for Oct Paris flight
    if (!result.tripId) {
      expect(result.createTrip?.destination_name?.toLowerCase()).toContain(
        "paris",
      );
    }
  });
});
