/** Deterministic day/time helpers for the AI itinerary importer (not the Suggester). */

export type ImportItemType =
  | "place"
  | "flight"
  | "hotel"
  | "train"
  | "ground_transport"
  | "other";

export type ImportDraftItem = {
  title: string;
  description?: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  itemType?: ImportItemType;
  notes?: string;
  dayNumber?: number;
  date?: string;
};

export type ImportDraftDay = {
  dayNumber: number;
  date?: string;
  title?: string;
  items: ImportDraftItem[];
};

export type ImportArrangement = {
  days: ImportDraftDay[];
};

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function tripDayCount(
  startDate?: string | null,
  endDate?: string | null,
): number {
  if (!startDate) return 3;
  const start = parseDateOnly(startDate);
  if (!start) return 3;
  if (!endDate) return 1;
  const end = parseDateOnly(endDate);
  if (!end) return 1;
  const days =
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(31, days));
}

export function parseDateOnly(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isFinite(d.getTime()) ? d : null;
}

export function addDaysToDate(startDate: string, offset: number): string {
  const base = parseDateOnly(startDate);
  if (!base) return startDate;
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

export function dayNumberToDate(
  startDate: string | null | undefined,
  dayNumber: number,
): string | undefined {
  if (!startDate || dayNumber < 1) return undefined;
  return addDaysToDate(startDate, dayNumber - 1);
}

export function dateToDayNumber(
  startDate: string | null | undefined,
  date: string,
): number | undefined {
  if (!startDate) return undefined;
  const start = parseDateOnly(startDate);
  const d = parseDateOnly(date);
  if (!start || !d) return undefined;
  const n = Math.round((d.getTime() - start.getTime()) / 86_400_000) + 1;
  return n >= 1 ? n : undefined;
}

export function normalizeHhMm(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const m24 = trimmed.match(HHMM);
  if (m24) {
    return `${m24[1]!.padStart(2, "0")}:${m24[2]}`;
  }
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m12) {
    let h = Number(m12[1]);
    const min = m12[2]!;
    const ap = m12[3]!.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  return undefined;
}

export function parseHmMinutes(value: string): number {
  const n = normalizeHhMm(value);
  if (!n) return 0;
  const [h, m] = n.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToHm(total: number): string {
  const m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function defaultDurationMinutes(item: ImportDraftItem): number {
  if (item.durationMinutes && item.durationMinutes > 0) {
    return item.durationMinutes;
  }
  const t = `${item.title} ${item.description ?? ""}`.toLowerCase();
  if (/\b(breakfast|lunch|dinner|brunch|meal|café|cafe|restaurant)\b/.test(t)) {
    return 60;
  }
  if (/\b(flight|airport|check[- ]?in)\b/.test(t)) return 120;
  if (/\b(hotel|check[- ]?out)\b/.test(t)) return 30;
  return 90;
}

export function importFingerprint(input: {
  title: string;
  date?: string | null;
  startTime?: string | null;
}): string {
  const title = input.title.trim().toLowerCase().replace(/\s+/g, " ");
  const date = (input.date ?? "").trim();
  const start = normalizeHhMm(input.startTime) ?? (input.startTime ?? "").trim();
  return `${title}|${date}|${start}`;
}

export function combineDateTime(
  tripStart: string | null | undefined,
  dayNumber: number,
  hm?: string | null,
  absoluteDate?: string | null,
): string | null {
  const date =
    absoluteDate && parseDateOnly(absoluteDate)
      ? absoluteDate.slice(0, 10)
      : dayNumberToDate(tripStart, dayNumber);
  if (!date) return null;
  const time = normalizeHhMm(hm ?? undefined) ?? "09:00";
  const base = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(base.getTime())) return null;
  const [h, m] = time.split(":").map(Number);
  base.setUTCHours(h ?? 9, m ?? 0, 0, 0);
  return base.toISOString();
}

export function endAtFromStart(
  startIso: string | null,
  durationMinutes: number,
): string | null {
  if (!startIso) return null;
  const d = new Date(startIso);
  if (!Number.isFinite(d.getTime())) return null;
  d.setUTCMinutes(d.getUTCMinutes() + Math.max(15, durationMinutes));
  return d.toISOString();
}

/** Assign dates from trip window; warn when Day N exceeds trip length. */
export function mapDaysOntoTrip(
  arrangement: ImportArrangement,
  startDate?: string | null,
  endDate?: string | null,
): { arrangement: ImportArrangement; warnings: string[] } {
  const warnings: string[] = [];
  const maxDays = tripDayCount(startDate, endDate);
  const end = endDate ? parseDateOnly(endDate) : null;

  const days = arrangement.days.map((day) => {
    let dayNumber = Math.max(1, day.dayNumber || 1);
    let date = day.date;

    if (date && startDate) {
      const n = dateToDayNumber(startDate, date);
      if (n) dayNumber = n;
      const d = parseDateOnly(date);
      if (startDate && d) {
        const start = parseDateOnly(startDate);
        if (start && d < start) {
          warnings.push(
            `Activity date ${date} is before trip start ${startDate}; clamped to Day 1.`,
          );
          dayNumber = 1;
          date = startDate;
        }
      }
      if (end && d && d > end) {
        warnings.push(
          `Activity date ${date} is after trip end ${endDate}; moved to last trip day.`,
        );
        dayNumber = maxDays;
        date = endDate ?? date;
      }
    } else if (startDate) {
      if (dayNumber > maxDays) {
        warnings.push(
          `Day ${dayNumber} exceeds the ${maxDays}-day trip; mapped to Day ${maxDays}.`,
        );
        dayNumber = maxDays;
      }
      date = dayNumberToDate(startDate, dayNumber);
    }

    return {
      ...day,
      dayNumber,
      date,
      items: day.items.map((item) => ({
        ...item,
        dayNumber,
        date: date ?? item.date,
        startTime: normalizeHhMm(item.startTime) ?? item.startTime,
        endTime: normalizeHhMm(item.endTime) ?? item.endTime,
        durationMinutes: defaultDurationMinutes(item),
      })),
    };
  });

  return { arrangement: { days }, warnings };
}

/** When AI returns a flat list with no days, spread across trip days in order. */
export function distributeAcrossDays(
  items: ImportDraftItem[],
  startDate?: string | null,
  endDate?: string | null,
): ImportArrangement {
  const maxDays = tripDayCount(startDate, endDate);
  if (items.length === 0) {
    return {
      days: Array.from({ length: maxDays }, (_, i) => ({
        dayNumber: i + 1,
        date: startDate ? dayNumberToDate(startDate, i + 1) : undefined,
        items: [],
      })),
    };
  }
  const perDay = Math.ceil(items.length / maxDays);
  const days: ImportDraftDay[] = [];
  for (let d = 0; d < maxDays; d++) {
    const slice = items.slice(d * perDay, (d + 1) * perDay);
    days.push({
      dayNumber: d + 1,
      date: startDate ? dayNumberToDate(startDate, d + 1) : undefined,
      items: slice.map((item) => ({
        ...item,
        dayNumber: d + 1,
        date: startDate ? dayNumberToDate(startDate, d + 1) : item.date,
      })),
    });
  }
  return { days: days.filter((d) => d.items.length > 0) };
}

const CROWDED_MINUTES = 10 * 60; // 10h of activities

/** Fill missing start times; flag overlaps and crowded days. Never drops items. */
export function fillTimesAndDetectIssues(
  arrangement: ImportArrangement,
): { arrangement: ImportArrangement; warnings: string[]; flags: string[] } {
  const warnings: string[] = [];
  const flags: string[] = [];

  const days = arrangement.days.map((day) => {
    let cursor = 9 * 60; // 09:00
    const items = day.items.map((item, idx) => {
      const duration = defaultDurationMinutes(item);
      let start = normalizeHhMm(item.startTime);
      let end = normalizeHhMm(item.endTime);

      if (!start) {
        start = minutesToHm(cursor);
        warnings.push(
          `Estimated ${start} for “${item.title}” on Day ${day.dayNumber} (no time provided).`,
        );
      } else {
        cursor = parseHmMinutes(start);
      }

      if (!end) {
        end = minutesToHm(parseHmMinutes(start) + duration);
      }

      const startM = parseHmMinutes(start);
      const endM = parseHmMinutes(end);
      if (idx > 0) {
        const prev = day.items[idx - 1]!;
        const prevEnd = normalizeHhMm(prev.endTime);
        if (prevEnd && parseHmMinutes(prevEnd) > startM) {
          flags.push(
            `Possible overlap: “${prev.title}” and “${item.title}” on Day ${day.dayNumber}.`,
          );
        }
      }

      cursor = Math.max(cursor, endM) + 15; // buffer before next

      return {
        ...item,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        dayNumber: day.dayNumber,
        date: day.date ?? item.date,
      };
    });

    const total = items.reduce(
      (sum, i) => sum + (i.durationMinutes ?? defaultDurationMinutes(i)),
      0,
    );
    if (total > CROWDED_MINUTES && items.length > 3) {
      flags.push(
        `Day ${day.dayNumber} looks crowded (~${Math.round(total / 60)}h of activities). Consider moving some stops.`,
      );
    }

    return { ...day, items };
  });

  return { arrangement: { days }, warnings, flags };
}

/**
 * Build a lightly optimized arrangement: move overflow items from crowded days
 * onto following days when the trip has spare capacity. Preserves overall order.
 */
export function buildOptimizedArrangement(
  arrangement: ImportArrangement,
  startDate?: string | null,
  endDate?: string | null,
): { arrangement: ImportArrangement; changes: string[] } {
  const maxDays = tripDayCount(startDate, endDate);
  const changes: string[] = [];
  const buckets: ImportDraftItem[][] = Array.from(
    { length: maxDays },
    () => [],
  );

  const ordered = arrangement.days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .flatMap((d) => d.items.map((item) => ({ ...item, dayNumber: d.dayNumber, date: d.date })));

  for (const item of ordered) {
    let dayIdx = Math.min(maxDays, Math.max(1, item.dayNumber ?? 1)) - 1;
    const duration = defaultDurationMinutes(item);
    const dayLoad = (idx: number) =>
      buckets[idx]!.reduce((s, i) => s + defaultDurationMinutes(i), 0);

    while (
      dayIdx < maxDays - 1 &&
      dayLoad(dayIdx) + duration > CROWDED_MINUTES &&
      buckets[dayIdx]!.length >= 3
    ) {
      changes.push(
        `Suggested moving “${item.title}” from Day ${dayIdx + 1} to Day ${dayIdx + 2} to ease crowding.`,
      );
      dayIdx += 1;
    }

    const date = startDate ? dayNumberToDate(startDate, dayIdx + 1) : item.date;
    buckets[dayIdx]!.push({
      ...item,
      dayNumber: dayIdx + 1,
      date,
    });
  }

  const days: ImportDraftDay[] = buckets
    .map((items, i) => ({
      dayNumber: i + 1,
      date: startDate ? dayNumberToDate(startDate, i + 1) : undefined,
      items,
    }))
    .filter((d) => d.items.length > 0);

  const filled = fillTimesAndDetectIssues({ days });
  return { arrangement: filled.arrangement, changes };
}

export function flattenArrangement(
  arrangement: ImportArrangement,
): ImportDraftItem[] {
  return arrangement.days.flatMap((d) =>
    d.items.map((item) => ({
      ...item,
      dayNumber: d.dayNumber,
      date: d.date ?? item.date,
    })),
  );
}

/**
 * Lightweight non-AI parse for Day N / time lines — used for demos and tests.
 * Does not invent destinations beyond the pasted line text.
 */
export function parseItineraryTextHeuristic(
  text: string,
  startDate?: string | null,
  endDate?: string | null,
): ImportArrangement {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dayHeader =
    /^(?:day\s*(\d+)|(\d{4}-\d{2}-\d{2}))\b[:\s-]*/i;
  const timePrefix =
    /^(?:(\d{1,2}:\d{2}\s*(?:am|pm)?)|(\d{1,2}:\d{2}))\s*[–—\-]\s*(.+)$/i;

  const days: ImportDraftDay[] = [];
  let current: ImportDraftDay | null = null;

  const ensureDay = (n: number, date?: string) => {
    current = {
      dayNumber: n,
      date: date ?? (startDate ? dayNumberToDate(startDate, n) : undefined),
      items: [],
    };
    days.push(current);
  };

  for (const line of lines) {
    const dh = line.match(dayHeader);
    if (dh) {
      if (dh[2]) {
        const date = dh[2];
        const n = dateToDayNumber(startDate, date) ?? days.length + 1;
        ensureDay(n, date);
      } else {
        ensureDay(Number(dh[1]));
      }
      continue;
    }

    if (!current) ensureDay(1);

    const bullet = line.replace(/^[-*•\d.)]+\s*/, "");
    const tm = bullet.match(timePrefix);
    if (tm) {
      const startTime = normalizeHhMm(tm[1] || tm[2]);
      const rest = (tm[3] || "").trim();
      current!.items.push({
        title: rest || bullet,
        locationName: rest || undefined,
        startTime,
        itemType: "place",
        dayNumber: current!.dayNumber,
        date: current!.date,
      });
      continue;
    }

    current!.items.push({
      title: bullet,
      locationName: bullet,
      itemType: "place",
      dayNumber: current!.dayNumber,
      date: current!.date,
    });
  }

  if (days.length === 0) {
    return distributeAcrossDays(
      lines.map((title) => ({ title, itemType: "place" as const })),
      startDate,
      endDate,
    );
  }

  const mapped = mapDaysOntoTrip({ days }, startDate, endDate);
  const filled = fillTimesAndDetectIssues(mapped.arrangement);
  return filled.arrangement;
}

export function isDuplicateAgainstExisting(
  draft: ImportDraftItem,
  existing: Array<{
    title: string;
    start_at: string | null;
    details?: Record<string, unknown> | null;
  }>,
): boolean {
  const date = draft.date ?? "";
  const start = normalizeHhMm(draft.startTime) ?? "";
  const fp = importFingerprint({
    title: draft.title,
    date,
    startTime: start,
  });

  for (const row of existing) {
    const details = (row.details ?? {}) as Record<string, unknown>;
    if (details.importFingerprint === fp) return true;
    if (details.source === "ai_itinerary_import" && details.importFingerprint === fp) {
      return true;
    }
    const titleMatch =
      row.title.trim().toLowerCase() === draft.title.trim().toLowerCase();
    if (!titleMatch || !row.start_at) continue;
    const day = row.start_at.slice(0, 10);
    const hm = `${String(new Date(row.start_at).getUTCHours()).padStart(2, "0")}:${String(new Date(row.start_at).getUTCMinutes()).padStart(2, "0")}`;
    if (day === date && hm === start) return true;
  }
  return false;
}
