import type { ItineraryItem, Trip } from "@/types/database";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function tripDays(trip: Trip): number {
  if (!trip.start_date || !trip.end_date) return 0;
  const start = Date.parse(trip.start_date);
  const end = Date.parse(trip.end_date);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export type TravelStats = {
  completedTrips: number;
  upcomingTrips: number;
  activeTrips: number;
  totalTravelDays: number;
  countriesVisited: number;
  citiesVisited: number;
  mostVisited: string | null;
  distanceKmEstimated: number | null;
  distanceLabel: string;
  tripsPerYear: Array<{ year: number; count: number }>;
  distancePerYearKm: Array<{ year: number; km: number }>;
  destinations: Array<{ name: string; count: number }>;
  durationBuckets: Array<{ label: string; count: number }>;
};

function countryFromDestination(name: string | null): string | null {
  if (!name) return null;
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1]!;
  return null;
}

function cityFromDestination(name: string | null): string | null {
  if (!name) return null;
  return name.split(",")[0]?.trim() || name.trim();
}

/**
 * Aggregate travel history from the user's trips + flight itinerary legs.
 * Distances are great-circle estimates only when coordinates exist.
 */
export function computeTravelStats(
  trips: Trip[],
  flightItems: ItineraryItem[],
  unit: "km" | "mi" = "mi",
): TravelStats {
  const completed = trips.filter((t) => t.status === "completed");
  const upcoming = trips.filter(
    (t) => t.status === "planned" || t.status === "active",
  );
  const active = trips.filter((t) => t.status === "active");

  const cityCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  for (const trip of completed) {
    const city = cityFromDestination(trip.destination_name);
    const country = countryFromDestination(trip.destination_name);
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    if (country) countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  let mostVisited: string | null = null;
  let mostCount = 0;
  for (const [name, count] of cityCounts) {
    if (count > mostCount) {
      mostVisited = name;
      mostCount = count;
    }
  }

  const tripsPerYearMap = new Map<number, number>();
  const durationBuckets = new Map<string, number>();
  let totalTravelDays = 0;
  for (const trip of completed) {
    const year = trip.start_date
      ? Number(trip.start_date.slice(0, 4))
      : Number(trip.created_at.slice(0, 4));
    if (Number.isFinite(year)) {
      tripsPerYearMap.set(year, (tripsPerYearMap.get(year) ?? 0) + 1);
    }
    const days = tripDays(trip);
    totalTravelDays += days;
    const label =
      days <= 0 ? "Unknown" : days <= 3 ? "1–3 days" : days <= 7 ? "4–7 days" : "8+ days";
    durationBuckets.set(label, (durationBuckets.get(label) ?? 0) + 1);
  }

  // Estimate distance from consecutive itinerary flight coords (dedupe by id)
  const seenFlights = new Set<string>();
  let distanceKm = 0;
  let hasDistance = false;
  const distancePerYear = new Map<number, number>();
  for (const item of flightItems) {
    if (item.item_type !== "flight") continue;
    if (seenFlights.has(item.id)) continue;
    seenFlights.add(item.id);
    const details = (item.details ?? {}) as Record<string, unknown>;
    const oLat = Number(details.originLat ?? item.latitude);
    const oLon = Number(details.originLon ?? item.longitude);
    const dLat = Number(details.destLat);
    const dLon = Number(details.destLon);
    if (
      ![oLat, oLon, dLat, dLon].every((n) => Number.isFinite(n)) ||
      (oLat === dLat && oLon === dLon)
    ) {
      continue;
    }
    const km = haversineKm(oLat, oLon, dLat, dLon);
    distanceKm += km;
    hasDistance = true;
    const year = (item.start_at ?? item.created_at).slice(0, 4);
    const y = Number(year);
    if (Number.isFinite(y)) {
      distancePerYear.set(y, (distancePerYear.get(y) ?? 0) + km);
    }
  }

  const factor = unit === "mi" ? 0.621371 : 1;
  const distanceValue = hasDistance ? Math.round(distanceKm * factor) : null;

  return {
    completedTrips: completed.length,
    upcomingTrips: upcoming.length,
    activeTrips: active.length,
    totalTravelDays,
    countriesVisited: countryCounts.size,
    citiesVisited: cityCounts.size,
    mostVisited,
    distanceKmEstimated: hasDistance ? Math.round(distanceKm) : null,
    distanceLabel:
      distanceValue == null
        ? "Unavailable (need flight coordinates)"
        : `~${distanceValue.toLocaleString()} ${unit} (estimated)`,
    tripsPerYear: [...tripsPerYearMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count })),
    distancePerYearKm: [...distancePerYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, km]) => ({ year, km: Math.round(km) })),
    destinations: [...cityCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count })),
    durationBuckets: ["1–3 days", "4–7 days", "8+ days", "Unknown"]
      .filter((label) => (durationBuckets.get(label) ?? 0) > 0)
      .map((label) => ({ label, count: durationBuckets.get(label) ?? 0 })),
  };
}
