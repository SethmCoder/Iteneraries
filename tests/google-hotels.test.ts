import { describe, expect, it } from "vitest";
import { mapGooglePlaceToHotel } from "@/lib/hotels/google-places";

describe("mapGooglePlaceToHotel", () => {
  it("maps lodging place with photo proxy and price level", () => {
    const hotel = mapGooglePlaceToHotel({
      id: "ChIJtest",
      displayName: { text: "Hotel Villa Fontaine Roppongi" },
      formattedAddress: "1-6-2 Roppongi, Minato City, Tokyo, Japan",
      location: { latitude: 35.662, longitude: 139.731 },
      rating: 4.2,
      userRatingCount: 1200,
      priceLevel: "PRICE_LEVEL_MODERATE",
      photos: [{ name: "places/ChIJtest/photos/ABC123" }],
      googleMapsUri: "https://maps.google.com/?cid=1",
      types: ["lodging", "hotel"],
    });

    expect(hotel).not.toBeNull();
    expect(hotel!.name).toContain("Villa Fontaine");
    expect(hotel!.source).toBe("google");
    expect(hotel!.priceLabel).toBe("$$");
    expect(hotel!.photoUrl).toContain("/api/hotels/photo?name=");
    expect(hotel!.lat).toBeCloseTo(35.662, 2);
    expect(hotel!.rating).toBe(4.2);
  });

  it("rejects places without coordinates", () => {
    expect(
      mapGooglePlaceToHotel({
        displayName: { text: "Mystery Inn" },
        formattedAddress: "Somewhere",
      }),
    ).toBeNull();
  });
});
