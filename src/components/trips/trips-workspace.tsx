"use client";

import { useMemo, useState } from "react";
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
      <section className="space-y-3">
        <NewItineraryButton className="w-full sm:hidden" />
        {trips.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border bg-card p-8 text-center">
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
      <section className="min-h-[420px] lg:min-h-[calc(100vh-10rem)]">
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
