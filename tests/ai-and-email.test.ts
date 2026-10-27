import { describe, expect, it } from "vitest";
import { parseSuggestions } from "@/lib/ai/suggest-itinerary";
import { reservationExtractSchema } from "@/lib/ai/extract-reservation";
import { normalizeBookingKey } from "@/lib/email/normalize";
import { getRoute } from "@/lib/routing";

describe("AI suggestion validation", () => {
  it("accepts valid structured suggestions", () => {
    const parsed = parseSuggestions({
      days: [
        {
          dayNumber: 1,
          title: "Arrival",
          items: [
            {
              title: "Museum visit",
              description: "Modern art",
              category: "museum",
              locationName: "MoMA, New York",
              startTime: "10:00",
              durationMinutes: 120,
            },
          ],
        },
      ],
      notes: null,
    });
    expect(parsed.days[0].items[0].title).toBe("Museum visit");
  });

  it("rejects invalid suggestion payloads", () => {
    expect(() => parseSuggestions({ days: [] })).toThrow();
  });
});

describe("email extraction schema", () => {
  it("validates flight reservations", () => {
    const result = reservationExtractSchema.safeParse({
      reservations: [
        {
          type: "flight",
          confirmationNumber: "ABC123",
          airline: "Demo Air",
          flightNumber: "DA100",
          departureAirport: "SFO",
          arrivalAirport: "JFK",
          departureTime: "2026-05-01T09:00",
          arrivalTime: "2026-05-01T17:30",
          passengerNames: ["Ada Lovelace"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("builds stable booking keys for duplicate prevention", () => {
    const extracted = {
      type: "flight" as const,
      confirmationNumber: "ABC123",
      airline: "Demo Air",
      flightNumber: "DA100",
      departureAirport: "SFO",
      arrivalAirport: "JFK",
      departureTime: "2026-05-01T09:00",
      arrivalTime: "2026-05-01T17:30",
      passengerNames: undefined,
    };
    const a = normalizeBookingKey(extracted);
    const b = normalizeBookingKey(extracted);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("routing failure handling", () => {
  it("returns an unavailable transit result when OTP is unset", async () => {
    const result = await getRoute({
      mode: "transit",
      from: { lat: 47.6, lon: -122.3 },
      to: { lat: 47.62, lon: -122.35 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailableReason).toMatch(/not configured|Transit/i);
    }
  });
});

