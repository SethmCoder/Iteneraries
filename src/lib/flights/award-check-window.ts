export type AwardCheckWindowPrefs = {
  award_check_enabled: boolean;
  award_check_timezone: string;
  award_check_start_minute: number;
  award_check_end_minute: number;
};

/** Local minutes-from-midnight in an IANA timezone. */
export function localMinutesInTimezone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return ((hour % 24) * 60 + minute) % 1440;
  } catch {
    // Invalid timezone → treat as UTC
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/**
 * True when award checks should run for this user.
 * Overnight windows supported (e.g. 22:00–01:00).
 */
export function isInAwardCheckWindow(
  now: Date,
  prefs: AwardCheckWindowPrefs | null | undefined,
): boolean {
  if (!prefs || !prefs.award_check_enabled) return true;

  const start = ((prefs.award_check_start_minute % 1440) + 1440) % 1440;
  const end = ((prefs.award_check_end_minute % 1440) + 1440) % 1440;
  const tz = prefs.award_check_timezone?.trim() || "UTC";
  const local = localMinutesInTimezone(now, tz);

  if (start === end) return true; // full day
  if (start < end) return local >= start && local < end;
  // Overnight: e.g. 22:00–01:00
  return local >= start || local < end;
}

export function minutesToTimeInput(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return (Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m))) % 1440;
}
