/**
 * Deterministic itinerary draft scaffolding when AI is unavailable.
 * Uses only user-provided must-dos / destination labels — never invents
 * flights, hotels, fares, or opening hours.
 */

export type DraftItem = {
  title: string;
  description?: string;
  category: string;
  locationName?: string;
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
};

function dayCount(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 3;
  const a = Date.parse(startDate);
  const b = Date.parse(endDate);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 3;
  const days = Math.floor((b - a) / 86_400_000) + 1;
  return Math.min(7, Math.max(1, days));
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out.length ? out : [[]];
}

export function buildDeterministicDrafts(input: {
  destination: string;
  startDate?: string;
  endDate?: string;
  mustDos?: string[];
  pace?: string;
}): DeterministicDraft[] {
  const dest = input.destination.trim() || "Destination";
  const musts = (input.mustDos ?? []).map((m) => m.trim()).filter(Boolean);
  const daysN = dayCount(input.startDate, input.endDate);
  const pace = input.pace ?? "balanced";
  const perDay =
    pace === "relaxed" ? 2 : pace === "packed" ? 4 : 3;

  const placeholders: DraftItem[] = [
    ...musts.map((m) => ({
      title: m,
      category: "must_do",
      description: "User must-do — verify hours and tickets yourself.",
      locationName: dest,
    })),
    {
      title: `Explore ${dest}`,
      category: "attraction",
      description:
        "Placeholder stop — replace with a verified place from the map or search.",
      locationName: dest,
    },
    {
      title: `Local meal in ${dest}`,
      category: "restaurant",
      description: "Unverified suggestion slot — pick a restaurant you trust.",
      locationName: dest,
    },
  ];

  while (placeholders.length < daysN * Math.max(1, perDay - 1)) {
    placeholders.push({
      title: `Free time / buffer in ${dest}`,
      category: "flex",
      description: "Buffer for travel, rest, or jet lag — not a booking.",
      locationName: dest,
    });
  }

  const groups = chunk(placeholders, perDay).slice(0, daysN);
  while (groups.length < daysN) {
    groups.push([
      {
        title: `Open day in ${dest}`,
        category: "flex",
        description: "No verified activities assigned — add from your trip map.",
        locationName: dest,
      },
    ]);
  }

  const balancedDays: DraftDay[] = groups.map((items, i) => ({
    dayNumber: i + 1,
    title: `Day ${i + 1}`,
    items,
  }));

  const notes =
    "Drafts are scaffolds from your inputs only. No flights, hotels, or prices were invented. Confirm every stop before booking.";

  const drafts: DeterministicDraft[] = [
    {
      id: "balanced",
      label: "Balanced scaffold",
      reason: "Spreads must-dos and open slots across your trip dates.",
      days: balancedDays,
      notes,
    },
    {
      id: "must-first",
      label: "Must-dos first",
      reason: "Front-loads your must-dos, then open exploration slots.",
      days: balancedDays.map((d) => ({
        ...d,
        items: [...d.items].sort((a, b) =>
          a.category === "must_do" ? -1 : b.category === "must_do" ? 1 : 0,
        ),
      })),
      notes,
    },
    {
      id: "lighter",
      label: "Lighter days",
      reason: "Fewer stops per day for a relaxed pace (still unverified places).",
      days: balancedDays.map((d) => ({
        ...d,
        items: d.items.slice(0, Math.max(1, Math.ceil(d.items.length / 2))),
      })),
      notes,
    },
  ];

  return drafts;
}
