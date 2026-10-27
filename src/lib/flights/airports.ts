import airportsData from "../../../data/airports.lean.json";

export type AirportOption = {
  code: string;
  city: string;
  name: string;
  country: string;
};

const AIRPORTS = airportsData as AirportOption[];

/** Common hubs get a small ranking boost so short queries surface useful airports. */
const HUB_BOOST = new Set([
  "ATL", "LAX", "ORD", "DFW", "DEN", "JFK", "SFO", "SEA", "LAS", "MCO",
  "EWR", "CLT", "PHX", "IAH", "MIA", "BOS", "MSP", "FLL", "DTW", "PHL",
  "LGA", "BWI", "SLC", "SAN", "IAD", "TPA", "DCA", "MDW", "HNL",
  "LHR", "LGW", "CDG", "AMS", "FRA", "MUC", "MAD", "BCN", "FCO", "DXB",
  "DOH", "SIN", "HKG", "NRT", "HND", "ICN", "SYD", "MEL", "YYZ", "YVR",
]);

/** Score query against an airport; higher is better. */
export function scoreAirportMatch(airport: AirportOption, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const code = airport.code.toLowerCase();
  const city = airport.city.toLowerCase();
  const name = airport.name.toLowerCase();
  const country = airport.country.toLowerCase();
  const hub = HUB_BOOST.has(airport.code) ? 40 : 0;

  if (code === q) return 1000 + hub;
  if (code.startsWith(q)) return 900 - (code.length - q.length) + hub;
  if (city === q) return 800 + hub;
  if (city.startsWith(q)) return 700 + hub;
  if (name.startsWith(q)) return 650 + hub;
  if (city.includes(q)) return 500 + hub;
  if (name.includes(q)) return 450 + hub;
  if (`${city} ${name}`.includes(q)) return 400 + hub;
  if (country === q) return 200 + hub;
  // Token match: "san fran" → San Francisco
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => city.includes(t) || name.includes(t))) {
    return 550 + hub;
  }
  return 0;
}

export function searchAirports(query: string, limit = 10): AirportOption[] {
  const q = query.trim();
  if (q.length < 1) return [];
  return AIRPORTS.map((a) => ({ a, score: scoreAirportMatch(a, q) }))
    .filter((x) => x.score > 0)
    .sort(
      (x, y) =>
        y.score - x.score ||
        x.a.city.localeCompare(y.a.city) ||
        x.a.code.localeCompare(y.a.code),
    )
    .slice(0, limit)
    .map((x) => x.a);
}

export function getAirportByCode(code: string): AirportOption | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  return AIRPORTS.find((a) => a.code === c) ?? null;
}
