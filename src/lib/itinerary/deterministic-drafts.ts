/**
 * Deterministic itinerary drafts when AI is unavailable.
 * Uses scheduleTripDays — no Free-time padding spam; unscheduled gaps are labeled.
 */

import { scheduleTripDays } from "@/lib/itinerary/schedule-day";
import type { ResolvedPlace } from "@/lib/places/resolve";

export type DraftItem = {
  title: string;
  description?: string;
  category: string;
  locationName?: string;
  startTime?: string;
  durationMinutes?: number;
};

export type DraftDay = {
  dayNumber: number;
  title?: string;
  items: DraftItem[];
};

export type DeterministicDraft = {
  id: string;
  label: string;
  reason: string;
  days: DraftDay[];
  notes?: string;
  excluded?: Array<{ title: string; reason: string }>;
};

export function buildDeterministicDrafts(input: {
  destination: string;
  startDate?: string;
  endDate?: string;
  mustDos?: string[];
  pace?: string;
  saved?: ResolvedPlace[];
}): DeterministicDraft[] {
  const dest = input.destination.trim() || "Destination";
  const musts = (input.mustDos ?? []).map((m) => m.trim()).filter(Boolean);

  const mustResolved: ResolvedPlace[] = musts.map((m) => ({
    name: m,
    address: `${m}, ${dest}`,
    lat: null,
    lon: null,
    osmType: null,
    osmId: null,
    category: "must_do",
    openingHoursRaw: null,
    hoursStatus: "unknown",
    estimatedDurationMinutes: 90,
    durationIsEstimate: true,
    sourceQuery: m,
  }));

  const scheduled = scheduleTripDays({
    destination: dest,
    startDate: input.startDate,
    endDate: input.endDate,
    pace: (input.pace as "balanced") ?? "balanced",
    mustDos: mustResolved.map((m) => ({ ...m, required: true })),
    saved: input.saved ?? [],
  });

  const toDraftDays = (days: typeof scheduled.days): DraftDay[] =>
    days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      items: d.items.map((i) => ({
        title: i.title,
        description: i.description,
        category: i.category,
        locationName: i.locationName,
        startTime: i.startTime,
        durationMinutes: i.durationMinutes,
      })),
    }));

  const notes =
    "Drafts use Must-Dos and Saved Places only. No flights, hotels, or opening hours were invented. Confirm every stop before booking.";

  return [
    {
      id: "balanced",
      label: "Balanced schedule",
      reason: "Timed day plan from your Must-Dos (and lists when provided).",
      days: toDraftDays(scheduled.days),
      notes,
      excluded: scheduled.excluded,
    },
    {
      id: "lighter",
      label: "Lighter days",
      reason: "Fewer stops per day.",
      days: toDraftDays(
        scheduled.days.map((d) => ({
          ...d,
          items: d.items.filter(
            (i, idx) => i.source === "meal" || idx < Math.ceil(d.items.length / 2),
          ),
        })),
      ),
      notes,
      excluded: scheduled.excluded,
    },
    {
      id: "must-first",
      label: "Must-dos first",
      reason: "Front-loads Must-Do stops each day.",
      days: toDraftDays(
        scheduled.days.map((d) => ({
          ...d,
          items: [...d.items].sort((a, b) => {
            const score = (s: string) => (s === "must_do" ? 0 : 1);
            return score(a.source) - score(b.source);
          }),
        })),
      ),
      notes,
      excluded: scheduled.excluded,
    },
  ];
}
