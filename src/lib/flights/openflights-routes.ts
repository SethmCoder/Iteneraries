import routesData from "../../../data/openflights-routes.lean.json";
import { getAirportByCode } from "@/lib/flights/openflights-airports";
import { AIRLINES } from "@/lib/flights/airlines";

export type RouteOption = {
  from: string;
  to: string;
  airline: string;
  airlineName: string;
  stops: number;
};

export type FlightItinerary = {
  id: string;
  kind: "nonstop" | "one_stop";
  from: string;
  to: string;
  via: string | null;
  viaCity: string | null;
  stops: number;
  airline: string;
  airlineName: string;
  /** Second airline when legs differ */
  airline2: string | null;
  airlineName2: string | null;
  legs: RouteOption[];
};

const AIRLINE_NAMES = new Map<string, string>(
  AIRLINES.map((a) => [a.code, a.name]),
);

const HUB_BOOST = new Set([
  "ATL", "LAX", "ORD", "DFW", "DEN", "JFK", "SFO", "SEA", "LAS", "MCO",
  "EWR", "CLT", "PHX", "IAH", "MIA", "BOS", "MSP", "FLL", "DTW", "PHL",
  "LGA", "BWI", "SLC", "SAN", "IAD", "TPA", "DCA", "MDW", "HNL",
  "LHR", "LGW", "CDG", "AMS", "FRA", "MUC", "MAD", "BCN", "FCO", "DXB",
  "DOH", "SIN", "HKG", "NRT", "HND", "ICN", "SYD", "MEL", "YYZ", "YVR",
]);

type LeanRoute = {
  from: string;
  to: string;
  airline: string;
  airlineName: string;
  stops: number;
};

const ROUTES = routesData as LeanRoute[];

/** Index: "SFO|LAX" → routes */
let pairIndex: Map<string, LeanRoute[]> | null = null;
/** Origin → destination airports */
let outAdj: Map<string, Set<string>> | null = null;
/** Destination → origin airports */
let inAdj: Map<string, Set<string>> | null = null;

function ensureIndexes() {
  if (pairIndex && outAdj && inAdj) return;
  pairIndex = new Map();
  outAdj = new Map();
  inAdj = new Map();
  for (const r of ROUTES) {
    const key = `${r.from}|${r.to}`;
    const list = pairIndex.get(key);
    if (list) list.push(r);
    else pairIndex.set(key, [r]);

    let outs = outAdj.get(r.from);
    if (!outs) {
      outs = new Set();
      outAdj.set(r.from, outs);
    }
    outs.add(r.to);

    let ins = inAdj.get(r.to);
    if (!ins) {
      ins = new Set();
      inAdj.set(r.to, ins);
    }
    ins.add(r.from);
  }
}

function getIndex(): Map<string, LeanRoute[]> {
  ensureIndexes();
  return pairIndex!;
}

function resolveAirlineName(code: string, fallback: string): string {
  return AIRLINE_NAMES.get(code) ?? (fallback !== code ? fallback : code);
}

function toOption(r: LeanRoute): RouteOption {
  return {
    from: r.from,
    to: r.to,
    airline: r.airline,
    airlineName: resolveAirlineName(r.airline, r.airlineName),
    stops: r.stops,
  };
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
    .map(toOption);
}

type OneStopCandidate = {
  via: string;
  leg1: LeanRoute;
  leg2: LeanRoute;
  sameAirline: boolean;
};

/**
 * Nonstop + one-stop (via hub) itineraries from OpenFlights scheduled routes.
 * Not live schedules or fares — known commercial route pairs only.
 */
export function findFlights(
  origin: string,
  destination: string,
  limit = 30,
): FlightItinerary[] {
  const from = origin.trim().toUpperCase();
  const to = destination.trim().toUpperCase();
  if (!from || !to || from.length !== 3 || to.length !== 3 || from === to) {
    return [];
  }

  ensureIndexes();
  const idx = pairIndex!;
  const results: FlightItinerary[] = [];

  const nonstops = [...(idx.get(`${from}|${to}`) ?? [])].sort(
    (a, b) =>
      a.stops - b.stops ||
      a.airlineName.localeCompare(b.airlineName) ||
      a.airline.localeCompare(b.airline),
  );

  for (const r of nonstops) {
    if (results.length >= limit) break;
    const opt = toOption(r);
    results.push({
      id: `ns-${r.airline}-${r.stops}`,
      kind: "nonstop",
      from,
      to,
      via: null,
      viaCity: null,
      stops: r.stops,
      airline: opt.airline,
      airlineName: opt.airlineName,
      airline2: null,
      airlineName2: null,
      legs: [opt],
    });
  }

  if (results.length >= limit) return results;

  const fromHubs = outAdj!.get(from);
  const toHubs = inAdj!.get(to);
  if (!fromHubs || !toHubs) return results;

  const candidates: OneStopCandidate[] = [];
  for (const via of fromHubs) {
    if (via === from || via === to) continue;
    if (!toHubs.has(via)) continue;

    const leg1Options = idx.get(`${from}|${via}`) ?? [];
    const leg2Options = idx.get(`${via}|${to}`) ?? [];
    if (!leg1Options.length || !leg2Options.length) continue;

    const leg2ByAirline = new Map<string, LeanRoute>();
    for (const l2 of leg2Options) {
      if (!leg2ByAirline.has(l2.airline)) leg2ByAirline.set(l2.airline, l2);
    }

    let addedSame = false;
    for (const l1 of leg1Options) {
      const l2 = leg2ByAirline.get(l1.airline);
      if (l2) {
        candidates.push({ via, leg1: l1, leg2: l2, sameAirline: true });
        addedSame = true;
      }
    }

    // One mixed-airline fallback per hub when no same-airline connection
    if (!addedSame) {
      const l1 = leg1Options[0]!;
      const l2 = leg2Options[0]!;
      candidates.push({ via, leg1: l1, leg2: l2, sameAirline: false });
    }
  }

  candidates.sort((a, b) => {
    if (a.sameAirline !== b.sameAirline) return a.sameAirline ? -1 : 1;
    const hubA = HUB_BOOST.has(a.via) ? 0 : 1;
    const hubB = HUB_BOOST.has(b.via) ? 0 : 1;
    if (hubA !== hubB) return hubA - hubB;
    return (
      a.via.localeCompare(b.via) ||
      a.leg1.airline.localeCompare(b.leg1.airline)
    );
  });

  const seen = new Set<string>();
  for (const c of candidates) {
    if (results.length >= limit) break;
    const key = `${c.via}|${c.leg1.airline}|${c.leg2.airline}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const leg1 = toOption(c.leg1);
    const leg2 = toOption(c.leg2);
    const viaInfo = getAirportByCode(c.via);
    const airline2 =
      c.leg1.airline === c.leg2.airline ? null : leg2.airline;
    const airlineName2 =
      airline2 == null
        ? null
        : resolveAirlineName(c.leg2.airline, c.leg2.airlineName);

    results.push({
      id: `os-${c.via}-${c.leg1.airline}-${c.leg2.airline}`,
      kind: "one_stop",
      from,
      to,
      via: c.via,
      viaCity: viaInfo?.city ?? null,
      stops: 1,
      airline: leg1.airline,
      airlineName: leg1.airlineName,
      airline2,
      airlineName2,
      legs: [leg1, leg2],
    });
  }

  return results;
}
