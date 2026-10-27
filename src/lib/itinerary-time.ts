import type { ItineraryItem } from "@/types/database";

export function toDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDayHeading(dateKey: string): string {
  if (dateKey === "unscheduled") return "Unscheduled";
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCardTime(iso: string | null | undefined): string {
  if (!iso) return "No time";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No time";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function groupItemsByDay(items: ItineraryItem[]): Map<string, ItineraryItem[]> {
  const groups = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const key = toDateKey(item.start_at) ?? "unscheduled";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => {
      const at = a.start_at ? new Date(a.start_at).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.start_at ? new Date(b.start_at).getTime() : Number.POSITIVE_INFINITY;
      if (at !== bt) return at - bt;
      return a.sort_order - b.sort_order;
    });
  }
  return groups;
}

export function sortedDayKeys(groups: Map<string, ItineraryItem[]>): string[] {
  return [...groups.keys()].sort((a, b) => {
    if (a === "unscheduled") return 1;
    if (b === "unscheduled") return -1;
    return a.localeCompare(b);
  });
}
