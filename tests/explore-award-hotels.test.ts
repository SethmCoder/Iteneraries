import { describe, expect, it } from "vitest";
import {
  awardHotelCities,
  formatAwardPriceLabel,
  getAwardHotelsMeta,
  searchAwardHotels,
} from "@/lib/explore/award-hotels";
import { listFlightDestinations } from "@/lib/explore/flight-destinations";

describe("award hotels catalog", () => {
  it("loads lean open-hotel-data catalog", () => {
    const meta = getAwardHotelsMeta();
    expect(meta.count).toBeGreaterThan(1000);
    expect(meta.source).toContain("open-hotel-data");
  });

  it("searches hotels by query and program", () => {
    const hits = searchAwardHotels({ q: "hilton", limit: 20 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.lat).toBeTypeOf("number");
  });

  it("aggregates cities with average prices when available", () => {
    const cities = awardHotelCities({ limit: 50 });
    expect(cities.length).toBeGreaterThan(10);
    expect(cities[0]?.hotelCount).toBeGreaterThan(0);
    const labeled = formatAwardPriceLabel({
      avgCashUsd: 220,
      avgPoints: null,
    });
    expect(labeled).toBe("$220");
  });
});

describe("flight destinations for explore", () => {
  it("lists destinations from an origin with cash estimates", () => {
    const dests = listFlightDestinations({ origin: "JFK", limit: 30 });
    expect(dests.length).toBeGreaterThan(5);
    expect(dests.every((d) => d.avgCashUsd != null)).toBe(true);
    expect(dests[0]?.distanceMi).toBeGreaterThan(0);
  });
});
