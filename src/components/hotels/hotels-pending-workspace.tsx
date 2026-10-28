"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, ExternalLink, Trash2 } from "lucide-react";
import {
  deletePendingHotelAction,
  savePendingHotelAction,
} from "@/app/actions/pending-bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bookingStatusClass,
  bookingStatusLabel,
} from "@/lib/pending/status";
import type { BookingStatus, PendingHotel } from "@/types/database";

type TripOption = { id: string; name: string | null; destination_name: string | null };

type FormState = {
  id?: string;
  tripId: string;
  hotelName: string;
  location: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  bookingStatus: BookingStatus;
  bookingUrl: string;
  notes: string;
};

function emptyForm(tripId: string | null): FormState {
  return {
    tripId: tripId ?? "",
    hotelName: "",
    location: "",
    checkIn: "",
    checkOut: "",
    rooms: 1,
    guests: 1,
    bookingStatus: "needs_booking",
    bookingUrl: "",
    notes: "",
  };
}

function rowToForm(row: PendingHotel): FormState {
  return {
    id: row.id,
    tripId: row.trip_id,
    hotelName: row.hotel_name,
    location: row.location ?? "",
    checkIn: row.check_in ?? "",
    checkOut: row.check_out ?? "",
    rooms: row.rooms,
    guests: row.guests,
    bookingStatus: row.booking_status,
    bookingUrl: row.booking_url ?? "",
    notes: row.notes ?? "",
  };
}

export function HotelsPendingWorkspace({
  hotels: initialHotels,
  trips,
  tripId,
  isDemo,
}: {
  hotels: PendingHotel[];
  trips: TripOption[];
  tripId: string | null;
  isDemo: boolean;
}) {
  const [hotels, setHotels] = useState(initialHotels);
  const [form, setForm] = useState<FormState>(() => emptyForm(tripId));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tripLabel = useMemo(() => {
    const map = new Map(
      trips.map((t) => [
        t.id,
        t.name || t.destination_name || "Untitled trip",
      ]),
    );
    return (id: string) => map.get(id) ?? "Trip";
  }, [trips]);

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function save() {
    setError(null);
    setMessage(null);
    if (!form.tripId) {
      setError("Select a trip");
      return;
    }
    if (!form.hotelName.trim()) {
      setError("Enter a hotel name");
      return;
    }

    const payload = {
      id: form.id,
      tripId: form.tripId,
      hotelName: form.hotelName,
      location: form.location || null,
      checkIn: form.checkIn || null,
      checkOut: form.checkOut || null,
      rooms: form.rooms,
      guests: form.guests,
      bookingStatus: form.bookingStatus,
      bookingUrl: form.bookingUrl || null,
      notes: form.notes || null,
    };

    if (isDemo) {
      const now = new Date().toISOString();
      const row: PendingHotel = {
        id: form.id ?? crypto.randomUUID(),
        user_id: "demo",
        trip_id: form.tripId,
        hotel_name: form.hotelName.trim(),
        location: form.location || null,
        check_in: form.checkIn || null,
        check_out: form.checkOut || null,
        rooms: form.rooms,
        guests: form.guests,
        booking_status: form.bookingStatus,
        booking_url: form.bookingUrl || null,
        notes: form.notes || null,
        created_at: now,
        updated_at: now,
      };
      setHotels((prev) => {
        const rest = prev.filter((h) => h.id !== row.id);
        return [row, ...rest];
      });
      setForm(emptyForm(tripId));
      setMessage("Hotel saved (preview)");
      return;
    }

    startTransition(async () => {
      try {
        await savePendingHotelAction(payload);
        setMessage(form.id ? "Hotel updated" : "Hotel added");
        const now = new Date().toISOString();
        const row: PendingHotel = {
          id: form.id ?? crypto.randomUUID(),
          user_id: "",
          trip_id: form.tripId,
          hotel_name: form.hotelName.trim(),
          location: form.location || null,
          check_in: form.checkIn || null,
          check_out: form.checkOut || null,
          rooms: form.rooms,
          guests: form.guests,
          booking_status: form.bookingStatus,
          booking_url: form.bookingUrl || null,
          notes: form.notes || null,
          created_at: now,
          updated_at: now,
        };
        setHotels((prev) => {
          const rest = prev.filter((h) => h.id !== form.id);
          return [row, ...rest];
        });
        setForm(emptyForm(tripId));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hotels Pending</h1>
        <p className="mt-1 text-sm text-muted">
          Assign hotels to a trip and track what still needs booking.
        </p>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">
            {form.id ? "Edit hotel" : "Add hotel"}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {form.id ? "Updating saved pending hotel" : "New pending hotel"}
            {tripId ? " · linked from current trip" : ""}
          </p>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hotel-trip">Trip</Label>
              <select
                id="hotel-trip"
                className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                value={form.tripId}
                onChange={(e) => patch({ tripId: e.target.value })}
              >
                <option value="">Select trip…</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.destination_name || "Untitled trip"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hotel-name">Hotel name</Label>
              <Input
                id="hotel-name"
                value={form.hotelName}
                onChange={(e) => patch({ hotelName: e.target.value })}
                placeholder="Property name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hotel-location">Location</Label>
              <Input
                id="hotel-location"
                value={form.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="City or address"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="check-in">Check-in</Label>
                <Input
                  id="check-in"
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => patch({ checkIn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-out">Check-out</Label>
                <Input
                  id="check-out"
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => patch({ checkOut: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rooms">Rooms</Label>
                <Input
                  id="rooms"
                  type="number"
                  min={1}
                  max={20}
                  value={form.rooms}
                  onChange={(e) =>
                    patch({ rooms: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guests">Guests</Label>
                <Input
                  id="guests"
                  type="number"
                  min={1}
                  max={30}
                  value={form.guests}
                  onChange={(e) =>
                    patch({ guests: Number(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hotel-status">Booking status</Label>
              <select
                id="hotel-status"
                className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                value={form.bookingStatus}
                onChange={(e) =>
                  patch({ bookingStatus: e.target.value as BookingStatus })
                }
              >
                <option value="needs_booking">Needs booking</option>
                <option value="in_progress">In progress</option>
                <option value="booked">Booked</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hotel-url">Booking URL (optional)</Label>
              <Input
                id="hotel-url"
                type="url"
                placeholder="https://"
                value={form.bookingUrl}
                onChange={(e) => patch({ bookingUrl: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hotel-notes">Notes</Label>
              <Input
                id="hotel-notes"
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => save()}>
                {form.id ? "Update hotel" : "Save hotel"}
              </Button>
              {form.id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setForm(emptyForm(tripId))}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Your pending hotels</h2>
          <p className="mt-0.5 text-xs text-muted">
            Status shows what still needs to be booked for each trip.
          </p>
          <div className="mt-3 space-y-3">
            {hotels.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center">
                <Building2 className="mx-auto h-8 w-8 text-brand/40" />
                <p className="mt-2 text-sm font-medium">No pending hotels</p>
                <p className="text-xs text-muted">
                  Add a hotel on the left to track booking for a trip.
                </p>
              </div>
            ) : (
              hotels.map((h) => (
                <div
                  key={h.id}
                  className="rounded-[12px] border border-border bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{h.hotel_name}</p>
                      <p className="text-xs text-muted">
                        {tripLabel(h.trip_id)}
                        {h.location ? ` · ${h.location}` : ""}
                        {h.check_in ? ` · ${h.check_in}` : ""}
                        {h.check_out ? ` – ${h.check_out}` : ""}
                        {` · ${h.rooms} room(s) · ${h.guests} guest(s)`}
                      </p>
                    </div>
                    <span
                      className={`rounded-[8px] border px-2 py-0.5 text-xs font-semibold ${bookingStatusClass(h.booking_status)}`}
                    >
                      {bookingStatusLabel(h.booking_status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setForm(rowToForm(h))}
                    >
                      Edit
                    </Button>
                    {h.booking_url ? (
                      <Button size="sm" variant="secondary" asChild>
                        <a
                          href={h.booking_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open booking
                          <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (isDemo) {
                          setHotels((prev) =>
                            prev.filter((x) => x.id !== h.id),
                          );
                          return;
                        }
                        startTransition(async () => {
                          await deletePendingHotelAction(h.id);
                          setHotels((prev) =>
                            prev.filter((x) => x.id !== h.id),
                          );
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
