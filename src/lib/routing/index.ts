import { getOsrmRoute } from "@/lib/routing/osrm";
import { getTransitRoute } from "@/lib/routing/transit";
import type { RouteRequest, RouteResult } from "@/lib/routing/types";

/** Dispatch a route request to the backend for its transport mode. */
export async function getRoute(request: RouteRequest): Promise<RouteResult> {
  if (request.mode === "transit") return getTransitRoute(request);
  return getOsrmRoute(request);
}

export { getOsrmRoute } from "@/lib/routing/osrm";
export { getTransitRoute } from "@/lib/routing/transit";
export * from "@/lib/routing/types";
