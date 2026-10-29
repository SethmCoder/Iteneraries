import { getCache, makeCacheKey, setCache, snapBounds } from "@/lib/poi/cache";
import { dedupePlaces } from "@/lib/poi/dedupe";
import { fetchPoisFromOverpass } from "@/lib/poi/overpass";
import type {
  PoiCategory,
  PoiPlace,
  PoiViewportResult,
  ViewportBounds,
} from "@/lib/poi/types";
import {
  getBandConfig,
  getCacheTtlMs,
  getCategoriesForZoom,
  getMarkerLimit,
  getZoomBand,
  shouldFetchPois,
} from "@/lib/poi/zoom-config";

export type GetPoisParams = ViewportBounds & {
  zoom: number;
  /** Optional user filter; intersected with the categories allowed at this zoom. */
  categories?: readonly PoiCategory[];
  signal?: AbortSignal;
  /** Skip the cache read (the fresh result is still cached). */
  forceRefresh?: boolean;
};

/** Coalesce concurrent identical viewport fetches (same process). */
const inFlight = new Map<string, Promise<PoiPlace[]>>();

function inBounds(place: PoiPlace, b: ViewportBounds): boolean {
  return (
    place.lat >= b.south &&
    place.lat <= b.north &&
    place.lon >= b.west &&
    place.lon <= b.east
  );
}

export async function getPoisForViewport(
  params: GetPoisParams,
): Promise<PoiViewportResult> {
  const { zoom, signal, forceRefresh } = params;
  const viewport: ViewportBounds = {
    south: params.south,
    west: params.west,
    north: params.north,
    east: params.east,
  };

  if (!shouldFetchPois(zoom)) {
    return { places: [], fromCache: false, disabled: true };
  }

  const band = getZoomBand(zoom);
  const allowed = getCategoriesForZoom(zoom);
  const categories = params.categories
    ? allowed.filter((c) => params.categories!.includes(c))
    : allowed;
  if (categories.length === 0) {
    return { places: [], fromCache: false, disabled: false };
  }

  const limit = getMarkerLimit(zoom);
  const snapped = snapBounds(viewport, band);
  const key = makeCacheKey(viewport, band, categories);

  if (!forceRefresh) {
    const cached = getCache(key);
    if (cached) {
      return {
        places: cached.filter((p) => inBounds(p, viewport)).slice(0, limit),
        fromCache: true,
        disabled: false,
      };
    }
  }

  let fetchPromise = inFlight.get(key);
  if (!fetchPromise) {
    fetchPromise = fetchPoisFromOverpass({
      ...snapped,
      categories,
      limit,
      signal,
      majorOnly: getBandConfig(zoom).majorOnly,
    })
      .then((fetched) => {
        const places = dedupePlaces(fetched);
        setCache(key, places, getCacheTtlMs(zoom));
        return places;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, fetchPromise);
  }

  const places = await fetchPromise;

  return {
    places: places.filter((p) => inBounds(p, viewport)).slice(0, limit),
    fromCache: false,
    disabled: false,
  };
}

export { dedupePlaces } from "@/lib/poi/dedupe";
export { fetchPoisFromOverpass, parseOverpassElements } from "@/lib/poi/overpass";
export { clearCache, clearPoiCache, getCached, makeCacheKey, setCached } from "@/lib/poi/cache";
export * from "@/lib/poi/types";
export * from "@/lib/poi/zoom-config";
