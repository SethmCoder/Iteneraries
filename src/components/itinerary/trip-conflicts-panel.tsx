"use client";

import type { TripConflict } from "@/lib/itinerary/conflicts";

export function TripConflictsPanel({ conflicts }: { conflicts: TripConflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
      <h2 className="font-semibold text-foreground">Needs attention</h2>
      <p className="mt-0.5 text-xs text-muted">
        Flags from your saved itinerary and pending bookings — resolve manually;
        confirmed bookings are never changed automatically.
      </p>
      <ul className="mt-3 space-y-2">
        {conflicts.map((c) => (
          <li
            key={c.id}
            className={`rounded-[10px] border px-3 py-2 text-sm ${
              c.severity === "error"
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-warning/40 bg-warning/5 text-warning"
            }`}
          >
            <p className="font-semibold">{c.title}</p>
            <p className="mt-0.5 text-xs opacity-90">{c.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
