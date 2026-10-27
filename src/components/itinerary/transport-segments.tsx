"use client";

import { useEffect, useState } from "react";
import { Bike, Bus, Car, Footprints } from "lucide-react";
import type { ItineraryItem } from "@/types/database";
import type { TransportMode } from "@/lib/routing/types";

const MODES: { id: TransportMode; label: string; icon: React.ReactNode }[] = [
  { id: "walking", label: "Walk", icon: <Footprints className="h-3.5 w-3.5" /> },
  { id: "car", label: "Car", icon: <Car className="h-3.5 w-3.5" /> },
  { id: "bicycle", label: "Bike", icon: <Bike className="h-3.5 w-3.5" /> },
  { id: "transit", label: "Transit", icon: <Bus className="h-3.5 w-3.5" /> },
];

function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function TransportSegmentList({
  from,
  to,
  canEdit,
}: {
  from: ItineraryItem;
  to: ItineraryItem;
  tripId: string;
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<TransportMode>("walking");
  const [duration, setDuration] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);

  const canRoute =
    from.latitude != null &&
    from.longitude != null &&
    to.latitude != null &&
    to.longitude != null;

  useEffect(() => {
    if (!canRoute) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/geo/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: { lat: from.latitude, lon: from.longitude },
            to: { lat: to.latitude, lon: to.longitude },
            mode,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.unavailableReason || "Route unavailable");
          setDuration(null);
          setDistance(null);
          return;
        }
        setDuration(data.durationSeconds ?? null);
        setDistance(data.distanceMeters ?? null);
      } catch {
        if (!cancelled) setError("Routing failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from.latitude, from.longitude, to.latitude, to.longitude, mode, canRoute]);

  if (!canRoute) {
    return (
      <div className="mt-2 rounded-[8px] border border-dashed border-border bg-white/70 px-3 py-2 text-xs text-muted">
        Not enough location data to calculate a route between {from.title} and{" "}
        {to.title}.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-[8px] border border-dashed border-border bg-white/70 px-3 py-2 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {from.title} → {to.title}
        </span>
        {canEdit
          ? MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1 rounded-[8px] border px-2 py-0.5 ${
                  mode === m.id
                    ? "border-brand bg-brand-light text-brand"
                    : "border-border bg-card"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))
          : null}
      </div>
      {loading ? <p className="mt-1">Calculating route…</p> : null}
      {!loading && duration != null ? (
        <p className="mt-1 text-foreground">
          {formatDuration(duration)}
          {distance != null ? ` · ${(distance / 1000).toFixed(1)} km` : ""}
        </p>
      ) : null}
      {!loading && error ? (
        <div className="mt-1 space-y-1">
          <p className="text-warning">{error}</p>
          {mode === "transit" || error.toLowerCase().includes("manual") ? (
            <label className="flex items-center gap-2">
              Manual duration (min)
              <input
                className="h-7 w-20 rounded-[8px] border border-input px-2"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
