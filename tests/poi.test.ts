import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPoiCache,
  dedupePlaces,
  getCached,
  getCategoriesForZoom,
  getMarkerLimit,
  makeCacheKey,
  parseOverpassElements,
  setCached,
  shouldFetchPois,
  getZoomBand,
} from "@/lib/poi";

describe("POI zoom config", () => {
  it("disables POI fetches at world zoom", () => {
    expect(shouldFetchPois(3)).toBe(false);
    expect(getCategoriesForZoom(3)).toEqual([]);
    expect(getMarkerLimit(3)).toBe(0);
  });

  it("returns progressive categories as zoom increases", () => {
    expect(getCategoriesForZoom(7)).toEqual([
      "attractions",
      "museums",
      "historic",
    ]);
    expect(getCategoriesForZoom(11)).toContain("restaurants");
    expect(getCategoriesForZoom(14)).toContain("cafes");
    expect(getCategoriesForZoom(17).length).toBeGreaterThan(
      getCategoriesForZoom(7).length,
    );
  });
});

describe("POI dedupe and cache", () => {
  beforeEach(() => clearPoiCache());

  it("deduplicates by osm type and id", () => {
    const places = dedupePlaces([
      {
        osmType: "node",
        osmId: 1,
        name: "A",
        category: "cafes",
        lat: 1,
        lon: 2,
      },
      {
        osmType: "node",
        osmId: 1,
        name: "A duplicate",
        category: "cafes",
        lat: 1,
        lon: 2,
      },
    ]);
    expect(places).toHaveLength(1);
  });

  it("caches by bounds, zoom band, and categories", () => {
    const band = getZoomBand(14);
    const key = makeCacheKey(
      { south: 48.8, west: 2.3, north: 48.9, east: 2.4 },
      band,
      ["cafes"],
    );
    setCached(
      key,
      [
        {
          osmType: "node",
          osmId: 9,
          name: "Cafe",
          category: "cafes",
          lat: 48.85,
          lon: 2.35,
        },
      ],
      60_000,
    );
    expect(getCached(key)?.[0]?.name).toBe("Cafe");
  });

  it("parses overpass elements without fabricating names", () => {
    const places = parseOverpassElements(
      [
        {
          type: "node",
          id: 10,
          lat: 48.86,
          lon: 2.29,
          tags: { name: "Eiffel Tower", tourism: "attraction" },
        },
        {
          type: "node",
          id: 11,
          lat: 48.86,
          lon: 2.3,
          tags: { tourism: "attraction" },
        },
      ],
      ["attractions"],
    );
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe("Eiffel Tower");
  });
});
