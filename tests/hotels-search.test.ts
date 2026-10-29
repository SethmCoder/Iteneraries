import { describe, expect, it, vi, afterEach } from "vitest";
import { searchHotels } from "@/lib/hotels/search";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("searchHotels", () => {
  it("maps Nominatim hotel hits for a brand query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            place_id: 1,
            lat: "35.7052932",
            lon: "139.7818821",
            name: "Hotel Villa Fontaine",
            display_name:
              "Hotel Villa Fontaine, Kojima, Taito, Tokyo, 111-0041, Japan",
            class: "tourism",
            type: "hotel",
            address: {
              suburb: "Kojima",
              city: "Tokyo",
              country: "Japan",
            },
          },
          {
            place_id: 2,
            lat: "35.6862937",
            lon: "139.7773576",
            name: "Hotel Villa Fontaine",
            display_name:
              "Hotel Villa Fontaine, Nihonbashi-Honchō, Chuo, Tokyo, Japan",
            class: "tourism",
            type: "hotel",
            address: {
              city: "Tokyo",
              country: "Japan",
            },
          },
        ],
      }),
    );

    const results = await searchHotels("Villa Fontaine");
    expect(results.length).toBe(2);
    expect(results[0]?.name).toContain("Villa Fontaine");
    expect(results[0]?.city).toBe("Tokyo");
    expect(results[0]?.lat).toBeCloseTo(35.705, 2);
    expect(results[0]?.priceLabel).toBe("Rates");
    expect(results[0]?.bookingSearchUrl).toContain("booking.com");
  });
});
