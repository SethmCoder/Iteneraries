export type PoiCategory =
  | "attractions"
  | "museums"
  | "restaurants"
  | "cafes"
  | "parks"
  | "historic"
  | "shopping";

export type OsmElementType = "node" | "way" | "relation";

export type PoiPlace = {
  osmType: OsmElementType;
  osmId: number;
  name: string;
  category: PoiCategory;
  lat: number;
  lon: number;
  address?: string;
  tags?: Record<string, string>;
};

export type ZoomBand = "world" | "region" | "city" | "neighborhood" | "street";

export type ViewportBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type PoiViewportResult = {
  places: PoiPlace[];
  fromCache: boolean;
  /** True when POI loading is disabled at this zoom level (nothing was fetched). */
  disabled: boolean;
};
