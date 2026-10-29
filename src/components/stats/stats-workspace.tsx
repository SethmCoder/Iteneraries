"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeTravelStats } from "@/lib/stats/travel-stats";
import type { ItineraryItem, Trip } from "@/types/database";

function BarChart({
  items,
  valueKey,
  labelKey,
}: {
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">No data yet</p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const pct = Math.round((value / max) * 100);
        return (
          <div key={String(item[labelKey])} className="grid grid-cols-[72px_1fr_40px] items-center gap-2 text-sm">
            <span className="truncate text-xs text-muted">{item[labelKey]}</span>
            <div className="h-3 overflow-hidden rounded-full bg-brand-light">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-right text-xs font-semibold">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsWorkspace({
  trips,
  flightItems,
}: {
  trips: Trip[];
  flightItems: ItineraryItem[];
}) {
  const [unit, setUnit] = useState<"mi" | "km">("mi");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const stats = useMemo(
    () => computeTravelStats(trips, flightItems, unit),
    [trips, flightItems, unit],
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const t of trips) {
      const y = Number((t.start_date ?? t.created_at).slice(0, 4));
      if (Number.isFinite(y)) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [trips]);

  const history = useMemo(() => {
    return [...trips]
      .filter((t) => {
        if (yearFilter === "all") return true;
        return (t.start_date ?? t.created_at).startsWith(yearFilter);
      })
      .sort((a, b) =>
        (b.start_date ?? b.created_at).localeCompare(a.start_date ?? a.created_at),
      );
  }, [trips, yearFilter]);

  const tripsPerYear = stats.tripsPerYear.map((r) => ({
    label: String(r.year),
    value: r.count,
  }));
  const distancePerYear = stats.distancePerYearKm.map((r) => ({
    label: String(r.year),
    value: unit === "mi" ? Math.round(r.km * 0.621371) : r.km,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Travel stats</h1>
          <p className="mt-1 text-sm text-muted">
            History and estimates from your saved trips. Distances are labeled when
            estimated from coordinates.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUnit("mi")}
            className={`rounded-[8px] border px-3 py-1.5 text-sm font-semibold ${
              unit === "mi" ? "border-brand bg-brand text-white" : "border-border"
            }`}
          >
            Miles
          </button>
          <button
            type="button"
            onClick={() => setUnit("km")}
            className={`rounded-[8px] border px-3 py-1.5 text-sm font-semibold ${
              unit === "km" ? "border-brand bg-brand text-white" : "border-border"
            }`}
          >
            Kilometers
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Completed trips", String(stats.completedTrips)],
          ["Travel days", String(stats.totalTravelDays)],
          ["Cities visited", String(stats.citiesVisited)],
          ["Countries visited", String(stats.countriesVisited)],
          ["Most visited", stats.mostVisited ?? "—"],
          ["Distance", stats.distanceLabel],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[12px] border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {label}
            </p>
            <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Trips per year</h2>
          <p className="text-xs text-muted">Completed trips only</p>
          <div className="mt-3">
            <BarChart items={tripsPerYear} labelKey="label" valueKey="value" />
          </div>
        </section>
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Distance per year</h2>
          <p className="text-xs text-muted">Estimated from flight coordinates when available</p>
          <div className="mt-3">
            <BarChart items={distancePerYear} labelKey="label" valueKey="value" />
          </div>
        </section>
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Destinations</h2>
          <div className="mt-3">
            <BarChart
              items={stats.destinations.map((d) => ({
                label: d.name,
                value: d.count,
              }))}
              labelKey="label"
              valueKey="value"
            />
          </div>
        </section>
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Trip duration</h2>
          <div className="mt-3">
            <BarChart
              items={stats.durationBuckets.map((d) => ({
                label: d.label,
                value: d.count,
              }))}
              labelKey="label"
              valueKey="value"
            />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Travel history</h2>
          <select
            className="h-9 rounded-[8px] border border-input bg-white px-2 text-sm"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {history.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted">
            No trips yet. Statistics appear as you complete trips.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {history.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="block overflow-hidden rounded-[12px] border border-border bg-card shadow-sm hover:bg-brand-light"
                >
                  {trip.destination_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={trip.destination_image_url}
                      alt=""
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-brand-light text-sm text-brand">
                      {trip.destination_name || "Trip"}
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-semibold">
                      {trip.name || trip.destination_name || "Untitled trip"}
                    </p>
                    <p className="text-xs text-muted">
                      {trip.start_date || "No dates"}
                      {trip.end_date ? ` → ${trip.end_date}` : ""}
                      {" · "}
                      <span className="capitalize">{trip.status}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
