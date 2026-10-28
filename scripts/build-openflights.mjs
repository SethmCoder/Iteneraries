#!/usr/bin/env node
/**
 * Download OpenFlights .dat files and write lean JSON for Waypoint.
 * Sources: https://github.com/jpatokal/openflights
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const BASE =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data";

async function fetchText(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return res.text();
}

/** Minimal CSV split respecting quoted fields. */
function splitCsv(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function isIata(code) {
  return /^[A-Z0-9]{3}$/.test(code);
}

mkdirSync(DATA, { recursive: true });

const [airportsRaw, routesRaw, airlinesRaw] = await Promise.all([
  fetchText("airports-extended.dat"),
  fetchText("routes.dat"),
  fetchText("airlines.dat"),
]);

const airlinesByCode = new Map();
for (const line of airlinesRaw.split("\n")) {
  if (!line.trim()) continue;
  const cols = splitCsv(line);
  // Airline ID, Name, Alias, IATA, ICAO, Callsign, Country, Active
  const name = cols[1]?.trim();
  const iata = cols[3]?.trim();
  if (name && iata && iata !== "\\N" && isIata(iata)) {
    if (!airlinesByCode.has(iata)) airlinesByCode.set(iata, name);
  }
}

const airports = [];
for (const line of airportsRaw.split("\n")) {
  if (!line.trim()) continue;
  const cols = splitCsv(line);
  // id, name, city, country, IATA, ICAO, lat, lon, alt, tz, dst, tzName, type, source
  const name = cols[1]?.trim() ?? "";
  const city = cols[2]?.trim() ?? "";
  const country = cols[3]?.trim() ?? "";
  const code = cols[4]?.trim() ?? "";
  const type = (cols[12]?.trim() ?? "airport").toLowerCase();
  if (type !== "airport") continue;
  if (!code || code === "\\N" || !isIata(code)) continue;
  const lat = Number(cols[6]);
  const lon = Number(cols[7]);
  airports.push({
    code,
    city: city === "\\N" ? "" : city,
    name: name === "\\N" ? "" : name,
    country: country === "\\N" ? "" : country,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  });
}

// Dedupe by IATA (prefer first)
const seenAirports = new Set();
const leanAirports = [];
for (const a of airports) {
  if (seenAirports.has(a.code)) continue;
  seenAirports.add(a.code);
  leanAirports.push(a);
}
leanAirports.sort((a, b) => a.code.localeCompare(b.code));

const routeKey = new Set();
const leanRoutes = [];
for (const line of routesRaw.split("\n")) {
  if (!line.trim()) continue;
  const cols = line.split(",");
  // Airline, Airline ID, Source airport, Source airport ID, Dest airport, Dest airport ID, Codeshare, Stops, Equipment
  const airline = cols[0]?.trim() ?? "";
  const from = cols[2]?.trim() ?? "";
  const to = cols[4]?.trim() ?? "";
  const stops = Number(cols[7] ?? 0);
  if (!isIata(from) || !isIata(to) || !airline || airline === "\\N") continue;
  const key = `${from}|${to}|${airline}`;
  if (routeKey.has(key)) continue;
  routeKey.add(key);
  leanRoutes.push({
    from,
    to,
    airline,
    airlineName: airlinesByCode.get(airline) ?? airline,
    stops: Number.isFinite(stops) ? stops : 0,
  });
}

writeFileSync(
  join(DATA, "openflights-airports.lean.json"),
  JSON.stringify(leanAirports),
);
writeFileSync(
  join(DATA, "openflights-routes.lean.json"),
  JSON.stringify(leanRoutes),
);

console.log(
  `Wrote ${leanAirports.length} airports, ${leanRoutes.length} routes → data/openflights-*.lean.json`,
);
