import {
  getAirportByCode,
  type AirportOption,
} from "@/lib/flights/openflights-airports";
import routesData from "../../../data/openflights-routes.lean.json";

export type FlightDestination = {
  code: string;
  city: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  routeCount: number;
  /** Rough economy cash estimate USD based on great-circle distance (not live fares). */
  avgCashUsd: number | null;
  /** Rough miles distance from origin when origin is set. */
  distanceMi: number | null;
};

type LeanRoute = {
  from: string;
  to: string;
  airline: string;
  airlineName: string;
  stops: number;
};

const ROUTES = routesData as LeanRoute[];

let outCounts: Map<string, number> | null = null;
let fromToCounts: Map<string, Map<string, number>> | null = null;

function ensureRouteCounts() {
  if (outCounts && fromToCounts) return;
  outCounts = new Map();
  fromToCounts = new Map();
  for (const r of ROUTES) {
    outCounts.set(r.from, (outCounts.get(r.from) ?? 0) + 1);
    let destMap = fromToCounts.get(r.from);
    if (!destMap) {
      destMap = new Map();
      fromToCounts.set(r.from, destMap);
    }
    destMap.set(r.to, (destMap.get(r.to) ?? 0) + 1);
  }
}

function haversineMi(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Ballpark economy cash from distance — clearly labeled as estimate in UI. */
function estimateCashUsd(distanceMi: number): number {
  const raw = distanceMi < 800 ? distanceMi * 0.15 : 80 + distanceMi * 0.09;
  return Math.round(Math.min(2500, Math.max(79, raw)));
}

function toDestination(
  airport: AirportOption,
  routeCount: number,
  origin: AirportOption | null,
): FlightDestination | null {
  if (airport.lat == null || airport.lon == null) return null;
  const distanceMi =
    origin != null && origin.lat != null && origin.lon != null
      ? Math.round(
          haversineMi(
            { lat: origin.lat, lon: origin.lon },
            { lat: airport.lat, lon: airport.lon },
          ),
        )
      : null;
  return {
    code: airport.code,
    city: airport.city,
    name: airport.name,
    country: airport.country,
    lat: airport.lat,
    lon: airport.lon,
    routeCount,
    distanceMi,
    avgCashUsd: distanceMi != null ? estimateCashUsd(distanceMi) : null,
  };
}

export function listFlightDestinations(opts: {
  origin?: string;
  q?: string;
  limit?: number;
}): FlightDestination[] {
  ensureRouteCounts();
  const originCode = opts.origin?.trim().toUpperCase() || "";
  const origin = originCode ? getAirportByCode(originCode) : null;
  const q = opts.q?.trim().toLowerCase() ?? "";
  const limit = Math.min(300, Math.max(1, opts.limit ?? 120));

  const rows: FlightDestination[] = [];

  if (origin) {
    const destMap = fromToCounts!.get(origin.code);
    if (destMap) {
      for (const [code, count] of destMap) {
        const ap = getAirportByCode(code);
        if (!ap) continue;
        const d = toDestination(ap, count, origin);
        if (d) rows.push(d);
      }
    }
  } else {
    for (const [code, count] of outCounts!) {
      if (count < 12) continue;
      const ap = getAirportByCode(code);
      if (!ap) continue;
      const d = toDestination(ap, count, null);
      if (d) rows.push(d);
    }
  }

  let filtered = rows;
  if (q) {
    filtered = rows.filter((r) => {
      const hay = `${r.city} ${r.name} ${r.country} ${r.code}`.toLowerCase();
      return hay.includes(q);
    });
  }

  filtered.sort((a, b) => b.routeCount - a.routeCount);
  return filtered.slice(0, limit);
}

export function formatFlightPriceLabel(d: FlightDestination): string {
  if (d.avgCashUsd != null) return `~$${d.avgCashUsd}`;
  return `${d.routeCount} rts`;
}
