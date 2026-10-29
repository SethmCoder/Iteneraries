"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Car,
  Plane,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bookingStatusClass,
  bookingStatusLabel,
} from "@/lib/pending/status";
import type {
  BookingStatus,
  PendingActivity,
  PendingCar,
  PendingFlight,
  PendingHotel,
} from "@/types/database";

type TripOption = { id: string; name: string | null; destination_name: string | null };

type UnifiedBooking = {
  id: string;
  kind: "flight" | "hotel" | "car" | "activity";
  title: string;
  subtitle: string;
  tripId: string;
  status: BookingStatus;
  href: string;
  reference?: string | null;
};

export function BookingsWorkspace({
  flights,
  hotels,
  cars,
  activities,
  trips,
  tripId,
}: {
  flights: PendingFlight[];
  hotels: PendingHotel[];
  cars: PendingCar[];
  activities: PendingActivity[];
  trips: TripOption[];
  tripId: string | null;
}) {
  const [filter, setFilter] = useState<"all" | UnifiedBooking["kind"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");

  const tripLabel = useMemo(() => {
    const map = new Map(
      trips.map((t) => [t.id, t.name || t.destination_name || "Untitled trip"]),
    );
    return (id: string) => map.get(id) ?? "Trip";
  }, [trips]);

  const rows = useMemo(() => {
    const all: UnifiedBooking[] = [
      ...flights.map((f) => ({
        id: f.id,
        kind: "flight" as const,
        title: `${f.origin} → ${f.destination}`,
        subtitle: [
          tripLabel(f.trip_id),
          f.airline,
          f.flight_number,
          f.depart_date,
        ]
          .filter(Boolean)
          .join(" · "),
        tripId: f.trip_id,
        status: f.booking_status,
        href: `/flights?tripId=${f.trip_id}`,
        reference: f.notes,
      })),
      ...hotels.map((h) => ({
        id: h.id,
        kind: "hotel" as const,
        title: h.hotel_name,
        subtitle: [
          tripLabel(h.trip_id),
          h.location,
          h.check_in && h.check_out
            ? `${h.check_in} → ${h.check_out}`
            : h.check_in,
        ]
          .filter(Boolean)
          .join(" · "),
        tripId: h.trip_id,
        status: h.booking_status,
        href: `/hotels?tripId=${h.trip_id}`,
        reference: h.notes,
      })),
      ...cars.map((c) => ({
        id: c.id,
        kind: "car" as const,
        title: c.provider || "Car rental",
        subtitle: [
          tripLabel(c.trip_id),
          c.pickup_location,
          c.pickup_at?.slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · "),
        tripId: c.trip_id,
        status: c.booking_status,
        href: `/bookings?tripId=${c.trip_id}`,
        reference: c.confirmation_number,
      })),
      ...activities.map((a) => ({
        id: a.id,
        kind: "activity" as const,
        title: a.title,
        subtitle: [
          tripLabel(a.trip_id),
          a.activity_type,
          a.location,
          a.start_at?.slice(0, 16),
        ]
          .filter(Boolean)
          .join(" · "),
        tripId: a.trip_id,
        status: a.booking_status,
        href: `/bookings?tripId=${a.trip_id}`,
        reference: a.confirmation_number,
      })),
    ];
    return all.filter((row) => {
      if (tripId && row.tripId !== tripId) return false;
      if (filter !== "all" && row.kind !== filter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [flights, hotels, cars, activities, filter, statusFilter, tripId, tripLabel]);

  const icon = (kind: UnifiedBooking["kind"]) => {
    if (kind === "flight") return <Plane className="h-4 w-4 text-brand" />;
    if (kind === "hotel") return <Building2 className="h-4 w-4 text-brand" />;
    if (kind === "car") return <Car className="h-4 w-4 text-brand" />;
    return <Calendar className="h-4 w-4 text-brand" />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
          Bookings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Flights, hotels, cars, and activities for your trips. Planned items
          stay separate until you mark them booked.
        </p>
      </div>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {(
          [
            ["all", "All"],
            ["flight", "Flights"],
            ["hotel", "Hotels"],
            ["car", "Cars"],
            ["activity", "Activities"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-[8px] border px-3 py-2 text-sm font-semibold ${
              filter === id
                ? "border-brand bg-brand text-white"
                : "border-border bg-card text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {(
          [
            ["all", "Any status"],
            ["needs_booking", "Needs booking"],
            ["in_progress", "In progress"],
            ["booked", "Booked"],
            ["skipped", "Skipped"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatusFilter(id)}
            className={`shrink-0 rounded-[8px] border px-2.5 py-1.5 text-xs font-medium ${
              statusFilter === id
                ? "border-brand bg-brand-light text-brand"
                : "border-border bg-white text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href={tripId ? `/flights?tripId=${tripId}` : "/flights"}>
            <Plane className="h-4 w-4" /> Flights Pending
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={tripId ? `/hotels?tripId=${tripId}` : "/hotels"}>
            <Building2 className="h-4 w-4" /> Hotels Pending
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-card px-4 py-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-brand/40" />
          <p className="mt-2 text-sm font-medium">No bookings yet</p>
          <p className="text-xs text-muted">
            Add pending flights or hotels, or forward confirmation emails.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <Link
                href={row.href}
                className="flex items-start justify-between gap-3 rounded-[12px] border border-border bg-card p-3 shadow-sm hover:bg-brand-light"
              >
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light">
                    {icon(row.kind)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{row.title}</p>
                    <p className="truncate text-xs text-muted">{row.subtitle}</p>
                    {row.reference ? (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        Ref / notes: {row.reference}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-[8px] border px-2 py-0.5 text-xs font-semibold ${bookingStatusClass(row.status)}`}
                >
                  {bookingStatusLabel(row.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
