import type {
  PoiCategory,
  PoiPlace,
  ViewportBounds,
  ZoomBand,
} from "@/lib/poi/types";
import { ZOOM_BANDS } from "@/lib/poi/zoom-config";

type Entry = { places: PoiPlace[]; expiresAt: number };

const MAX_ENTRIES = 200;
const store = new Map<string, Entry>();

function clampTo(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Snap bounds outward to the grid for a zoom band so the snapped box always
 * contains the original viewport and nearby viewports share cache entries.
 */
export function snapBounds(
  bounds: ViewportBounds,
  band: ZoomBand,
): ViewportBounds {
  const step = ZOOM_BANDS[band].boundsStepDeg;
  return {
    south: clampTo(round6(Math.floor(bounds.south / step) * step), -90, 90),
    west: clampTo(round6(Math.floor(bounds.west / step) * step), -180, 180),
    north: clampTo(round6(Math.ceil(bounds.north / step) * step), -90, 90),
    east: clampTo(round6(Math.ceil(bounds.east / step) * step), -180, 180),
  };
}

export function makeCacheKey(
  bounds: ViewportBounds,
  band: ZoomBand,
  categories: readonly PoiCategory[],
): string {
  const snapped = snapBounds(bounds, band);
  const cats = [...categories].sort().join(",");
  return [
    band,
    snapped.south,
    snapped.west,
    snapped.north,
    snapped.east,
    cats,
  ].join("|");
}

export function getCache(key: string, now: number = Date.now()): PoiPlace[] | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  // Refresh recency for simple LRU eviction.
  store.delete(key);
  store.set(key, entry);
  return entry.places;
}

export function setCache(
  key: string,
  places: PoiPlace[],
  ttlMs: number,
  now: number = Date.now(),
): void {
  if (ttlMs <= 0) return;
  store.delete(key);
  store.set(key, { places, expiresAt: now + ttlMs });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function clearCache(): void {
  store.clear();
}

/** Aliases for earlier naming. */
export const getCached = getCache;
export const setCached = setCache;
export const clearPoiCache = clearCache;
