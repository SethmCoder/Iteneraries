"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, ExternalLink, Search, Trash2 } from "lucide-react";
import {
  deletePendingHotelAction,
  savePendingHotelAction,
} from "@/app/actions/pending-bookings";
import { HotelSearchMap } from "@/components/hotels/hotel-search-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HotelSearchResult } from "@/lib/hotels/types";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HotelSearchResult[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pricesConfigured, setPricesConfigured] = useState(false);
  const [searchProvider, setSearchProvider] = useState<
    "google" | "openstreetmap" | null
  >(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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

  useEffect(() => {
    setSearchResults([]);
    setHasSearched(false);
    setSelectedHotelId(null);
    setSearchError(null);
  }, [searchQuery]);

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function applyHotelResult(hotel: HotelSearchResult) {
    setSelectedHotelId(hotel.id);
    const priceNote =
      hotel.averagePriceUsd != null
        ? `Sample avg ~$${hotel.averagePriceUsd}/night (OTA snapshot)`
        : hotel.source === "google"
          ? `Google lodging${hotel.rating != null ? ` · ${hotel.rating.toFixed(1)}★` : ""}${hotel.priceLabel !== "Rates" ? ` · ${hotel.priceLabel}` : ""}`
          : "Rates via Booking/Google — OpenStreetMap location";
    patch({
      hotelName: hotel.name,
      location: hotel.location,
      bookingStatus: "needs_booking",
      bookingUrl: hotel.bookingSearchUrl,
      notes: form.notes.trim() ? form.notes : priceNote,
    });
  }

  async function findHotels() {
    setSearchError(null);
    const q = searchQuery.trim() || form.hotelName.trim();
    if (q.length < 2) {
      setSearchError("Enter a hotel or brand name to search");
      return;
    }
    if (!searchQuery.trim() && form.hotelName.trim()) {
      setSearchQuery(form.hotelName.trim());
    }

    setSearchLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(
        `/api/hotels/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) {
        setSearchResults([]);
        setSearchError(
          res.status === 401
            ? "Sign in to search hotels"
            : "Could not search hotels. Try again.",
        );
        return;
      }
      const data = (await res.json()) as {
        results?: HotelSearchResult[];
        pricesConfigured?: boolean;
        provider?: "google" | "openstreetmap";
        googleConfigured?: boolean;
      };
      setSearchResults(data.results ?? []);
      setPricesConfigured(Boolean(data.pricesConfigured));
      setSearchProvider(data.provider ?? data.results?.[0]?.source ?? null);
      setGoogleConfigured(Boolean(data.googleConfigured));
      setSelectedHotelId(null);
    } catch {
      setSearchResults([]);
      setSearchError("Could not search hotels. Try again.");
    } finally {
      setSearchLoading(false);
    }
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
    if (
      form.checkIn &&
      form.checkOut &&
      form.checkOut <= form.checkIn
    ) {
      setError("Check-out must be after check-in");
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
          Assign hotels to a trip and track what still needs booking. Search
          uses Google Places lodging (photos + map) when{" "}
          <code className="text-xs">GOOGLE_PLACES_API_KEY</code> is set,
          otherwise OpenStreetMap.
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
              <Label htmlFor="hotel-search">Search hotels / brands</Label>
              <Input
                id="hotel-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void findHotels();
                  }
                }}
                placeholder='e.g. "Villa Fontaine"'
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={searchLoading || searchQuery.trim().length < 2}
                onClick={() => void findHotels()}
              >
                <Search className="mr-1.5 h-4 w-4" />
                {searchLoading ? "Finding hotels…" : "Find hotels"}
              </Button>
              {searchError ? (
                <p className="text-xs text-destructive">{searchError}</p>
              ) : null}
              {hasSearched ? (
                <div className="space-y-3 rounded-[10px] border border-border bg-[var(--page-bg)] p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {searchProvider === "google"
                        ? "Google Hotels / Places"
                        : "Hotel map (OpenStreetMap)"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {searchProvider === "google"
                        ? "Lodging options from Google Places — map pins, photos, ratings, and price level when available."
                        : googleConfigured
                          ? "Google returned no lodging matches; showing OpenStreetMap fallback."
                          : pricesConfigured
                            ? "Pins show sample average nightly rates when matched."
                            : "Add GOOGLE_PLACES_API_KEY for Google lodging photos & price levels. Click a result to fill the form."}
                    </p>
                  </div>
                  {searchLoading ? (
                    <p className="text-xs text-muted">Looking up properties…</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-muted">
                      No hotels found. Try a brand + city (e.g. “Villa Fontaine
                      Tokyo”)
                      {!googleConfigured
                        ? ", or set GOOGLE_PLACES_API_KEY for Google lodging search."
                        : "."}
                    </p>
                  ) : (
                    <>
                      <HotelSearchMap
                        hotels={searchResults}
                        selectedId={selectedHotelId}
                        onSelect={applyHotelResult}
                      />
                      <ul className="max-h-64 space-y-2 overflow-auto">
                        {searchResults.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              className={`flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left text-sm hover:bg-brand-light ${
                                selectedHotelId === h.id ? "bg-brand-light" : ""
                              }`}
                              onClick={() => applyHotelResult(h)}
                            >
                              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-border bg-white">
                                {h.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={h.photoUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-brand/40">
                                    <Building2 className="h-5 w-5" />
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="font-semibold text-brand">
                                  {h.name}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-muted">
                                  {h.location}
                                </span>
                                {h.rating != null ? (
                                  <span className="mt-0.5 block text-[11px] text-muted">
                                    {h.rating.toFixed(1)}★
                                    {h.userRatingCount != null
                                      ? ` · ${h.userRatingCount.toLocaleString()} reviews`
                                      : ""}
                                  </span>
                                ) : null}
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-bold">
                                  {h.priceLabel}
                                </span>
                                <a
                                  href={h.bookingSearchUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-muted underline-offset-2 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {h.source === "google" ? "Google" : "OTA"}
                                </a>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : null}
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

            <fieldset className="space-y-3 rounded-[10px] border border-border bg-[var(--page-bg)] p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Stay dates
              </legend>
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
                    min={form.checkIn || undefined}
                    onChange={(e) => patch({ checkOut: e.target.value })}
                  />
                </div>
              </div>
              {form.checkIn && form.checkOut ? (
                <p className="text-sm font-medium text-foreground">
                  {form.checkIn} → {form.checkOut}
                </p>
              ) : null}
            </fieldset>

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
