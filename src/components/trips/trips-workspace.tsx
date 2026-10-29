"use client";

import { useMemo, useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { WaypointMap } from "@/components/map/waypoint-map";
import { NewItineraryButton } from "@/components/trips/new-itinerary-button";
import { TripCard } from "@/components/trips/trip-card";
import { formatDateRange } from "@/lib/utils";
import type { Profile, Trip } from "@/types/database";

export function TripsWorkspace({
  trips,
  membersByTrip,
}: {
  trips: Trip[];
  membersByTrip: Record<string, Profile[]>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "map">("list");

  const pins = useMemo(
    () =>
      trips
        .filter(
          (t) =>
            typeof t.destination_latitude === "number" &&
            typeof t.destination_longitude === "number",
        )
        .map((t) => ({
          id: t.id,
          lat: t.destination_latitude!,
          lng: t.destination_longitude!,
          title: t.name?.trim() || "Untitled Trip",
          subtitle: `${t.destination_name ?? "Destination not set"} · ${formatDateRange(t.start_date, t.end_date)}`,
          href: `/trips/${t.id}`,
        })),
    [trips],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[38%_1fr]">
      <div
        className="flex gap-1 rounded-[12px] border border-border bg-card p-1 lg:hidden"
        role="tablist"
        aria-label="Trips list or map"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "list"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-colors ${
            mobilePane === "list"
              ? "bg-brand text-white"
              : "text-muted hover:bg-brand-light hover:text-brand"
          }`}
          onClick={() => setMobilePane("list")}
        >
          <List className="h-4 w-4" />
          Trips
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "map"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-colors ${
            mobilePane === "map"
              ? "bg-brand text-white"
              : "text-muted hover:bg-brand-light hover:text-brand"
          }`}
          onClick={() => setMobilePane("map")}
        >
          <MapIcon className="h-4 w-4" />
          Map
        </button>
      </div>

      <section
        className={`space-y-3 ${
          mobilePane === "list" ? "block" : "hidden lg:block"
        }`}
      >
        <NewItineraryButton className="w-full sm:hidden" />
        {trips.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border bg-card p-6 text-center sm:p-8">
            <h2 className="text-lg font-semibold">No trips yet</h2>
            <p className="mt-1 text-sm text-muted">
              Create your first itinerary to start planning.
            </p>
            <NewItineraryButton className="mt-4" />
          </div>
        ) : (
          <div className="space-y-2">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                collaborators={membersByTrip[trip.id] ?? []}
                selected={selectedId === trip.id}
                onHover={() => setSelectedId(trip.id)}
              />
            ))}
          </div>
        )}
      </section>
      <section
        className={`min-h-[min(70vh,28rem)] lg:min-h-[calc(100vh-10rem)] ${
          mobilePane === "map" ? "block" : "hidden lg:block"
        }`}
      >
        <WaypointMap
          pins={pins}
          selectedPinId={selectedId}
          onSelectPin={setSelectedId}
          enablePoi
          height="100%"
        />
      </section>
    </div>
  );
}
