import type { PoiCategory, ZoomBand } from "@/lib/poi/types";

/** All categories, in match-priority order (earlier wins when a feature matches several). */
export const POI_CATEGORIES: PoiCategory[] = [
  "attractions",
  "museums",
  "restaurants",
  "cafes",
  "parks",
  "historic",
  "shopping",
];

export type OsmTagFilter = {
  key: string;
  values: readonly string[];
};

/** OSM tag filters per category. A feature matches a category if ANY filter matches. */
export const CATEGORY_TAGS: Record<PoiCategory, readonly OsmTagFilter[]> = {
  attractions: [
    {
      key: "tourism",
      values: ["attraction", "viewpoint", "zoo", "theme_park", "aquarium"],
    },
  ],
  museums: [{ key: "tourism", values: ["museum", "gallery"] }],
  restaurants: [{ key: "amenity", values: ["restaurant", "food_court"] }],
  cafes: [{ key: "amenity", values: ["cafe"] }],
  parks: [{ key: "leisure", values: ["park", "garden", "nature_reserve"] }],
  historic: [
    {
      key: "historic",
      values: [
        "castle",
        "monument",
        "memorial",
        "ruins",
        "archaeological_site",
        "fort",
        "city_gate",
        "manor",
      ],
    },
  ],
  shopping: [
    {
      key: "shop",
      values: [
        "mall",
        "department_store",
        "gift",
        "books",
        "art",
        "antiques",
        "souvenir",
      ],
    },
    { key: "amenity", values: ["marketplace"] },
  ],
};

export type ZoomBandConfig = {
  /** Inclusive lower zoom bound. */
  minZoom: number;
  categories: readonly PoiCategory[];
  /** When true only features with a wikidata tag (major sights) are fetched. */
  majorOnly: boolean;
  markerLimit: number;
  cacheTtlMs: number;
  /** Grid step (degrees) used to snap bounds for caching and fetching. */
  boundsStepDeg: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const ZOOM_BANDS: Record<ZoomBand, ZoomBandConfig> = {
  world: {
    minZoom: -Infinity,
    categories: [],
    majorOnly: false,
    markerLimit: 0,
    cacheTtlMs: 0,
    boundsStepDeg: 1,
  },
  region: {
    minZoom: 5,
    categories: ["attractions", "museums", "historic"],
    majorOnly: true,
    markerLimit: 60,
    cacheTtlMs: 24 * HOUR,
    boundsStepDeg: 0.5,
  },
  city: {
    minZoom: 9,
    // Keep restaurants for higher zooms to cut Overpass load in dense cities
    categories: ["attractions", "museums", "parks", "historic"],
    majorOnly: true,
    markerLimit: 120,
    cacheTtlMs: 6 * HOUR,
    boundsStepDeg: 0.05,
  },
  neighborhood: {
    minZoom: 13,
    categories: [
      "attractions",
      "museums",
      "parks",
      "restaurants",
      "cafes",
      "historic",
      "shopping",
    ],
    majorOnly: false,
    markerLimit: 200,
    cacheTtlMs: HOUR,
    boundsStepDeg: 0.01,
  },
  street: {
    minZoom: 16,
    categories: POI_CATEGORIES,
    majorOnly: false,
    markerLimit: 200,
    cacheTtlMs: 30 * MINUTE,
    boundsStepDeg: 0.002,
  },
};

export function getZoomBand(zoom: number): ZoomBand {
  if (!Number.isFinite(zoom) || zoom < ZOOM_BANDS.region.minZoom) return "world";
  if (zoom < ZOOM_BANDS.city.minZoom) return "region";
  if (zoom < ZOOM_BANDS.neighborhood.minZoom) return "city";
  if (zoom < ZOOM_BANDS.street.minZoom) return "neighborhood";
  return "street";
}

export function getBandConfig(zoom: number): ZoomBandConfig {
  return ZOOM_BANDS[getZoomBand(zoom)];
}

export function shouldFetchPois(zoom: number): boolean {
  return getZoomBand(zoom) !== "world";
}

export function getCategoriesForZoom(zoom: number): PoiCategory[] {
  return [...getBandConfig(zoom).categories];
}

export function getMarkerLimit(zoom: number): number {
  return getBandConfig(zoom).markerLimit;
}

export function getCacheTtlMs(zoom: number): number {
  return getBandConfig(zoom).cacheTtlMs;
}

export function isMajorOnlyZoom(zoom: number): boolean {
  return getBandConfig(zoom).majorOnly;
}

/**
 * Determine which category an OSM feature belongs to, considering only the
 * allowed categories. Returns null when none match (never guesses).
 */
export function matchCategory(
  tags: Record<string, string>,
  allowed: readonly PoiCategory[],
): PoiCategory | null {
  for (const category of POI_CATEGORIES) {
    if (!allowed.includes(category)) continue;
    for (const filter of CATEGORY_TAGS[category]) {
      const value = tags[filter.key];
      if (value !== undefined && filter.values.includes(value)) {
        return category;
      }
    }
  }
  return null;
}
