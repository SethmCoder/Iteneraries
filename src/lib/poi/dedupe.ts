import type { PoiPlace } from "@/lib/poi/types";

export function placeKey(place: Pick<PoiPlace, "osmType" | "osmId">): string {
  return `${place.osmType}/${place.osmId}`;
}

/** Remove duplicate places by osmType + osmId, keeping the first occurrence. */
export function dedupePlaces(places: readonly PoiPlace[]): PoiPlace[] {
  const seen = new Set<string>();
  const result: PoiPlace[] = [];
  for (const place of places) {
    const key = placeKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }
  return result;
}
