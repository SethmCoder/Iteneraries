import type { PoiPlace } from "@/lib/poi/types";

type Entry = { places: PoiPlace[]; expiresAt: number };

const MAX_ENTRIES = 40;
const store = new Map<string, Entry>();

/** Browser-session POI cache so pan/zoom revisits skip the network round-trip. */
export function getClientPoiCache(
  key: string,
  now: number = Date.now(),
): PoiPlace[] | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.places;
}

export function setClientPoiCache(
  key: string,
  places: PoiPlace[],
  ttlMs: number = 5 * 60_000,
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

export function clearClientPoiCache(): void {
  store.clear();
}
