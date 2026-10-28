import routesData from "../../../data/openflights-routes.lean.json";
import { AIRLINES } from "@/lib/flights/airlines";

export type RouteOption = {
  from: string;
  to: string;
  airline: string;
  airlineName: string;
  stops: number;
};

const AIRLINE_NAMES = new Map<string, string>(
  AIRLINES.map((a) => [a.code, a.name]),
);

type LeanRoute = {
  from: string;
  to: string;
  airline: string;
  airlineName: string;
  stops: number;
};

const ROUTES = routesData as LeanRoute[];

/** Index: "SFO|LAX" → routes */
let index: Map<string, LeanRoute[]> | null = null;

function getIndex(): Map<string, LeanRoute[]> {
  if (index) return index;
  index = new Map();
  for (const r of ROUTES) {
    const key = `${r.from}|${r.to}`;
    const list = index.get(key);
    if (list) list.push(r);
    else index.set(key, [r]);
  }
  return index;
}

/**
 * Airlines known to operate origin→destination (OpenFlights scheduled routes).
 * Nonstops first, then by airline name.
 */
export function searchRoutes(
  origin: string,
  destination: string,
  limit = 20,
): RouteOption[] {
  const from = origin.trim().toUpperCase();
  const to = destination.trim().toUpperCase();
  if (!from || !to || from.length !== 3 || to.length !== 3) return [];

  const hits = getIndex().get(`${from}|${to}`) ?? [];
  return [...hits]
    .sort(
      (a, b) =>
        a.stops - b.stops ||
        a.airlineName.localeCompare(b.airlineName) ||
        a.airline.localeCompare(b.airline),
    )
    .slice(0, limit)
    .map((r) => ({
      from: r.from,
      to: r.to,
      airline: r.airline,
      airlineName:
        AIRLINE_NAMES.get(r.airline) ??
        (r.airlineName !== r.airline ? r.airlineName : r.airline),
      stops: r.stops,
    }));
}
