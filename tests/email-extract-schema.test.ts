import { describe, expect, it } from "vitest";
import { reservationExtractSchema } from "@/lib/ai/extract-reservation";
import { normalizeBookingKey } from "@/lib/email/normalize";

describe("multi-format reservation extract schema", () => {
  it("accepts restaurant and car_rental confirmations", () => {
    const parsed = reservationExtractSchema.parse({
      reservations: [
        {
          type: "restaurant",
          restaurantName: "Sushi Dai",
          address: "Tokyo",
          reservationTime: "2026-11-02T19:00",
          partySize: 2,
          confirmationNumber: "OT-123",
        },
        {
          type: "car_rental",
          provider: "Hertz",
          pickupLocation: "HNL Airport",
          pickupTime: "2026-11-03T10:00",
          dropoffTime: "2026-11-10T10:00",
          confirmationNumber: "HZ-9",
        },
        {
          type: "meeting",
          title: "Client kickoff",
          location: "WeWork Shibuya",
          startTime: "2026-11-04T09:00",
          endTime: "2026-11-04T10:00",
        },
      ],
    });
    expect(parsed.reservations).toHaveLength(3);
    expect(
      normalizeBookingKey(parsed.reservations[0]!),
    ).toContain("restaurant");
    expect(normalizeBookingKey(parsed.reservations[1]!)).toContain("car");
  });
});
