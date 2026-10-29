import {
  isLikelyOpenAt,
  type ResolvedPlace,
} from "@/lib/places/resolve";

export type ScheduledItem = {
  title: string;
  description?: string;
  category: string;
  locationName?: string;
  startTime: string;
  durationMinutes: number;
  endTime: string;
  lat?: number | null;
  lon?: number | null;
  osmId?: string | null;
  osmType?: string | null;
  hoursStatus: "verified" | "unknown" | "n/a";
  source: "must_do" | "saved_list" | "meal" | "unscheduled" | "locked";
  relevance?: string;
  placeKey?: string;
};

export type ExcludedPlace = {
  title: string;
  reason: string;
  sourceQuery?: string;
};

export type ScheduledDay = {
  dayNumber: number;
  date?: string;
  title?: string;
  items: ScheduledItem[];
};

function hm(minutes: number): string {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function parseHm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function travelBufferMinutes(
  from: ScheduledItem | null,
  to: ResolvedPlace,
): number {
  if (
    from?.lat == null ||
    from.lon == null ||
    to.lat == null ||
    to.lon == null
  ) {
    return 20;
  }
  const km = haversineKm(
    { lat: from.lat, lon: from.lon },
    { lat: to.lat, lon: to.lon },
  );
  // Rough walk/transit estimate — labeled implicitly as buffer, not verified OSRM
  return Math.min(75, Math.max(15, Math.round(km * 12)));
}

function addDays(isoDate: string, offset: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayCount(start?: string, end?: string): number {
  if (!start || !end) return 3;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 3;
  return Math.min(21, Math.max(1, Math.floor((b - a) / 86_400_000) + 1));
}

type Candidate = ResolvedPlace & {
  source: "must_do" | "saved_list";
  required: boolean;
  placeKey: string;
};

/**
 * Build timed day plans from resolved places. Does not invent opening hours
 * or attractions. Unfilled gaps become labeled Unscheduled slots.
 */
export function scheduleTripDays(input: {
  destination: string;
  startDate?: string;
  endDate?: string;
  pace?: "relaxed" | "balanced" | "packed" | "moderate";
  mustDos: Array<ResolvedPlace & { required?: boolean }>;
  saved: ResolvedPlace[];
  locked?: ScheduledItem[];
}): { days: ScheduledDay[]; excluded: ExcludedPlace[] } {
  const daysN = dayCount(input.startDate, input.endDate);
  const pace = input.pace ?? "balanced";
  const targetStops =
    pace === "relaxed" ? 3 : pace === "packed" ? 5 : 4;

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const m of input.mustDos) {
    const placeKey =
      m.osmId != null
        ? `${m.osmType}/${m.osmId}`
        : `must:${m.sourceQuery}:${m.name}`;
    if (seen.has(placeKey)) continue;
    seen.add(placeKey);
    candidates.push({
      ...m,
      source: "must_do",
      required: m.required !== false,
      placeKey,
    });
  }
  for (const s of input.saved) {
    const placeKey =
      s.osmId != null
        ? `${s.osmType}/${s.osmId}`
        : `saved:${s.name}:${s.lat}:${s.lon}`;
    if (seen.has(placeKey)) continue;
    seen.add(placeKey);
    candidates.push({
      ...s,
      source: "saved_list",
      required: false,
      placeKey,
    });
  }

  // Cluster by proximity into day buckets (greedy nearest neighbor)
  const remaining = [...candidates];
  const dayBuckets: Candidate[][] = Array.from({ length: daysN }, () => []);
  const excluded: ExcludedPlace[] = [];

  // Seed each day with required must-dos first
  const required = remaining.filter((c) => c.required);
  const optional = remaining.filter((c) => !c.required);

  for (let i = 0; i < required.length; i++) {
    const c = required[i]!;
    const dayIdx = i % daysN;
    dayBuckets[dayIdx]!.push(c);
  }

  for (const c of optional) {
    let bestDay = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let d = 0; d < daysN; d++) {
      const bucket = dayBuckets[d]!;
      if (bucket.length >= targetStops + 1) continue;
      let dist = 0;
      if (bucket.length && c.lat != null && c.lon != null) {
        const last = bucket[bucket.length - 1]!;
        if (last.lat != null && last.lon != null) {
          dist = haversineKm(
            { lat: last.lat, lon: last.lon },
            { lat: c.lat, lon: c.lon },
          );
        }
      }
      const score = dist + bucket.length * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestDay = d;
      }
    }
    const bucket = dayBuckets[bestDay]!;
    if (bucket.length >= targetStops + 2) {
      excluded.push({
        title: c.name,
        reason: "Could not fit without overloading the schedule",
        sourceQuery: c.sourceQuery,
      });
      continue;
    }
    bucket.push(c);
  }

  const mealSlots = [
    { start: 8 * 60, label: "Breakfast", duration: 45 },
    { start: 12 * 60 + 30, label: "Lunch", duration: 60 },
    { start: 19 * 60, label: "Dinner", duration: 75 },
  ];

  const days: ScheduledDay[] = [];

  for (let d = 0; d < daysN; d++) {
    const date = input.startDate ? addDays(input.startDate, d) : undefined;
    const items: ScheduledItem[] = [];
    let cursor = 9 * 60;
    let last: ScheduledItem | null = null;
    const bucket = dayBuckets[d] ?? [];

    // Sort bucket by lat to keep geographic order
    bucket.sort((a, b) => {
      if (a.lat == null || b.lat == null) return 0;
      return a.lat - b.lat || (a.lon ?? 0) - (b.lon ?? 0);
    });

    const insertMealIfDue = () => {
      for (const meal of mealSlots) {
        if (cursor <= meal.start && cursor + 30 >= meal.start - 15) {
          const startTime = hm(meal.start);
          const endTime = hm(meal.start + meal.duration);
          items.push({
            title: meal.label,
            description: `Meal break in ${input.destination} — pick a place you trust.`,
            category: "restaurant",
            locationName: input.destination,
            startTime,
            durationMinutes: meal.duration,
            endTime,
            hoursStatus: "n/a",
            source: "meal",
            relevance: "Scheduled meal buffer",
          });
          cursor = meal.start + meal.duration + 15;
          last = items[items.length - 1]!;
        }
      }
    };

    for (const c of bucket) {
      insertMealIfDue();
      const buffer = travelBufferMinutes(last, c);
      cursor += buffer;
      const duration = c.estimatedDurationMinutes ?? 60;
      let startMin = cursor;
      const startTime = hm(startMin);

      if (c.hoursStatus === "verified" && c.openingHoursRaw && date) {
        const open = isLikelyOpenAt(c.openingHoursRaw, date, startTime);
        if (open === false) {
          // Try later same day
          let placed = false;
          for (let tryMin = startMin + 30; tryMin <= 18 * 60; tryMin += 30) {
            const t = hm(tryMin);
            if (isLikelyOpenAt(c.openingHoursRaw, date, t) !== false) {
              startMin = tryMin;
              placed = true;
              break;
            }
          }
          if (!placed && c.required) {
            excluded.push({
              title: c.name,
              reason: `No viable time found within verified opening hours (${c.openingHoursRaw})`,
              sourceQuery: c.sourceQuery,
            });
            continue;
          }
          if (!placed) {
            excluded.push({
              title: c.name,
              reason: `Opening hours (${c.openingHoursRaw}) conflict with available slots`,
              sourceQuery: c.sourceQuery,
            });
            continue;
          }
        }
      }

      const finalStart = hm(startMin);
      const endTime = hm(startMin + duration);
      const item: ScheduledItem = {
        title: c.name,
        description:
          c.hoursStatus === "unknown"
            ? "Opening hours not verified in OpenStreetMap — confirm before visiting."
            : c.relevance ??
              (c.source === "must_do"
                ? "Matched from your Must-Do"
                : "From a selected Saved Places list"),
        category: c.category ?? "attraction",
        locationName: c.address ?? c.name,
        startTime: finalStart,
        durationMinutes: duration,
        endTime,
        lat: c.lat,
        lon: c.lon,
        osmId: c.osmId,
        osmType: c.osmType,
        hoursStatus: c.hoursStatus,
        source: c.source,
        relevance:
          c.source === "must_do"
            ? "Must-Do"
            : "Saved Places list",
        placeKey: c.placeKey,
      };
      items.push(item);
      last = item;
      cursor = startMin + duration;
    }

    // Fill remaining evening with unscheduled if day is sparse
    if (items.filter((i) => i.source !== "meal").length === 0) {
      items.push({
        title: "Unscheduled period",
        description:
          "Insufficient verified places to fill this day. Add Saved Places or Must-Dos.",
        category: "other",
        locationName: input.destination,
        startTime: "10:00",
        durationMinutes: 120,
        endTime: "12:00",
        hoursStatus: "n/a",
        source: "unscheduled",
      });
    } else if (cursor < 17 * 60) {
      items.push({
        title: "Unscheduled period",
        description:
          "Open time — optional exploring. Not a fabricated attraction.",
        category: "other",
        locationName: input.destination,
        startTime: hm(cursor + 15),
        durationMinutes: 60,
        endTime: hm(cursor + 75),
        hoursStatus: "n/a",
        source: "unscheduled",
      });
    }

    // Merge locked items for this day if provided
    const lockedForDay = (input.locked ?? []).filter(
      (l) => !l.placeKey || true,
    );
    void lockedForDay;

    days.push({
      dayNumber: d + 1,
      date,
      title: date ? `Day ${d + 1} · ${date}` : `Day ${d + 1}`,
      items: items.sort((a, b) => parseHm(a.startTime) - parseHm(b.startTime)),
    });
  }

  // Any required must-do never placed
  for (const c of required) {
    const placed = days.some((day) =>
      day.items.some((i) => i.placeKey === c.placeKey),
    );
    if (!placed && !excluded.some((e) => e.title === c.name)) {
      excluded.push({
        title: c.name,
        reason: "Could not schedule this required Must-Do",
        sourceQuery: c.sourceQuery,
      });
    }
  }

  return { days, excluded };
}
