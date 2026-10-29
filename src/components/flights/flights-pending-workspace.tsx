"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Plane, Trash2 } from "lucide-react";
import {
  deletePendingFlightAction,
  savePendingFlightAction,
} from "@/app/actions/pending-bookings";
import { AirportInput } from "@/components/flights/airport-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AIRLINES } from "@/lib/flights/airlines";
import {
  FLIGHT_MCP_SUPPORTED_ROUTES,
  type FlightMcpOffer,
} from "@/lib/flights/flight-mcp-cache";
import type { FlightItinerary } from "@/lib/flights/openflights-routes";
import { seatsAeroSearchUrl } from "@/lib/flights/seats-aero-links";
import {
  bookingStatusClass,
  bookingStatusLabel,
} from "@/lib/pending/status";
import type { BookingStatus, PendingFlight } from "@/types/database";

type TripOption = { id: string; name: string | null; destination_name: string | null };

type FormState = {
  id?: string;
  tripId: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  passengers: number;
  airline: string;
  flightNumber: string;
  bookingStatus: BookingStatus;
  bookingUrl: string;
  notes: string;
};

function emptyForm(tripId: string | null): FormState {
  return {
    tripId: tripId ?? "",
    origin: "",
    destination: "",
    departDate: "",
    returnDate: "",
    passengers: 1,
    airline: "",
    flightNumber: "",
    bookingStatus: "needs_booking",
    bookingUrl: "",
    notes: "",
  };
}

function rowToForm(row: PendingFlight): FormState {
  return {
    id: row.id,
    tripId: row.trip_id,
    origin: row.origin,
    destination: row.destination,
    departDate: row.depart_date ?? "",
    returnDate: row.return_date ?? "",
    passengers: row.passengers,
    airline: row.airline ?? "",
    flightNumber: row.flight_number ?? "",
    bookingStatus: row.booking_status,
    bookingUrl: row.booking_url ?? "",
    notes: row.notes ?? "",
  };
}

export function FlightsPendingWorkspace({
  flights: initialFlights,
  trips,
  tripId,
  isDemo,
}: {
  flights: PendingFlight[];
  trips: TripOption[];
  tripId: string | null;
  isDemo: boolean;
}) {
  const [flights, setFlights] = useState(initialFlights);
  const [form, setForm] = useState<FormState>(() => emptyForm(tripId));
  const [itineraries, setItineraries] = useState<FlightItinerary[]>([]);
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [fareOffers, setFareOffers] = useState<FlightMcpOffer[]>([]);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canFind =
    form.origin.trim().length === 3 && form.destination.trim().length === 3;

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
    setItineraries([]);
    setHasSearched(false);
    setFindError(null);
  }, [form.origin, form.destination]);

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function applyItinerary(it: FlightItinerary) {
    const viaNote =
      it.kind === "one_stop" && it.via
        ? `Via ${it.via}${it.viaCity ? ` (${it.viaCity})` : ""} · OpenFlights known route`
        : "OpenFlights known nonstop route";
    const airlineLabel =
      it.airline2 && it.airline2 !== it.airline
        ? `${it.airline}+${it.airline2}`
        : it.airline;
    patch({
      airline: it.airline,
      bookingStatus: "needs_booking",
      notes: form.notes.trim()
        ? form.notes
        : viaNote + (airlineLabel ? ` · ${airlineLabel}` : ""),
    });
  }

  async function findFlights() {
    setFindError(null);
    setMessage(null);
    const from = form.origin.trim().toUpperCase();
    const to = form.destination.trim().toUpperCase();
    if (from.length !== 3 || to.length !== 3) {
      setFindError("Choose origin and destination airports first");
      return;
    }
    if (from === to) {
      setFindError("Origin and destination must be different");
      return;
    }

    setFindLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(
        `/api/flights/routes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=find`,
      );
      if (!res.ok) {
        setItineraries([]);
        setFindError(
          res.status === 401
            ? "Sign in to search routes"
            : "Could not search routes. Try again.",
        );
        return;
      }
      const data = (await res.json()) as { results?: FlightItinerary[] };
      setItineraries(data.results ?? []);
    } catch {
      setItineraries([]);
      setFindError("Could not search routes. Try again.");
    } finally {
      setFindLoading(false);
    }
  }

  async function searchCachedFares() {
    setFareError(null);
    const from = form.origin.trim().toUpperCase();
    const to = form.destination.trim().toUpperCase();
    if (from.length !== 3 || to.length !== 3 || !form.departDate) {
      setFareError("Set origin, destination, and depart date for cached fares");
      return;
    }
    setFareLoading(true);
    try {
      const res = await fetch("/api/flights/cached-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: from,
          destination: to,
          departureDate: form.departDate,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; offers: FlightMcpOffer[] }
        | { ok: false; message?: string; error?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setFareOffers([]);
        setFareError(
          ("message" in data && data.message) ||
            ("error" in data && data.error) ||
            "No cached fares",
        );
        return;
      }
      setFareOffers(data.offers);
    } catch {
      setFareOffers([]);
      setFareError("Could not reach Flight MCP Open Cache");
    } finally {
      setFareLoading(false);
    }
  }

  function save() {
    setError(null);
    setMessage(null);
    if (!form.tripId) {
      setError("Select a trip");
      return;
    }
    if (form.origin.trim().length !== 3 || form.destination.trim().length !== 3) {
      setError("Choose origin and destination airports");
      return;
    }

    const payload = {
      id: form.id,
      tripId: form.tripId,
      origin: form.origin,
      destination: form.destination,
      departDate: form.departDate || null,
      returnDate: form.returnDate || null,
      passengers: form.passengers,
      airline: form.airline || null,
      flightNumber: form.flightNumber || null,
      bookingStatus: form.bookingStatus,
      bookingUrl: form.bookingUrl || null,
      notes: form.notes || null,
    };

    if (isDemo) {
      const now = new Date().toISOString();
      const row: PendingFlight = {
        id: form.id ?? crypto.randomUUID(),
        user_id: "demo",
        trip_id: form.tripId,
        origin: form.origin.toUpperCase(),
        destination: form.destination.toUpperCase(),
        depart_date: form.departDate || null,
        return_date: form.returnDate || null,
        passengers: form.passengers,
        airline: form.airline || null,
        flight_number: form.flightNumber || null,
        booking_status: form.bookingStatus,
        booking_url: form.bookingUrl || null,
        notes: form.notes || null,
        created_at: now,
        updated_at: now,
      };
      setFlights((prev) => {
        const rest = prev.filter((f) => f.id !== row.id);
        return [row, ...rest];
      });
      setForm(emptyForm(tripId));
      setMessage("Flight saved (preview)");
      return;
    }

    startTransition(async () => {
      try {
        await savePendingFlightAction(payload);
        setMessage(form.id ? "Flight updated" : "Flight added");
        setForm(emptyForm(tripId));
        // Optimistic local merge
        const now = new Date().toISOString();
        const row: PendingFlight = {
          id: form.id ?? crypto.randomUUID(),
          user_id: "",
          trip_id: form.tripId,
          origin: form.origin.toUpperCase(),
          destination: form.destination.toUpperCase(),
          depart_date: form.departDate || null,
          return_date: form.returnDate || null,
          passengers: form.passengers,
          airline: form.airline || null,
          flight_number: form.flightNumber || null,
          booking_status: form.bookingStatus,
          booking_url: form.bookingUrl || null,
          notes: form.notes || null,
          created_at: now,
          updated_at: now,
        };
        setFlights((prev) => {
          const rest = prev.filter((f) => f.id !== form.id);
          return [row, ...rest];
        });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Flights Pending</h1>
          <p className="mt-1 text-sm text-muted">
            Track trip flights with airline, route, and booking status. OpenFlights
            finds known routes; Flight MCP Open Cache shows limited cached cash
            fares (not live awards).
          </p>
        </div>
        {tripId ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/trips/${tripId}`}>Back to trip planning</Link>
            </Button>
            <Button asChild>
              <Link href={`/trips/${tripId}`}>Continue to major activities</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-[12px] border border-border bg-card p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold">
            {form.id ? "Edit flight" : "Add flight"}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {form.id ? "Updating saved pending flight" : "New pending flight"}
            {tripId ? " · linked from current trip" : ""}
          </p>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="flight-trip">Trip</Label>
              <select
                id="flight-trip"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="origin">Origin</Label>
                <AirportInput
                  id="origin"
                  value={form.origin}
                  onChange={(origin) => patch({ origin })}
                  placeholder="City or airport code"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination">Destination</Label>
                <AirportInput
                  id="destination"
                  value={form.destination}
                  onChange={(destination) => patch({ destination })}
                  placeholder="City or airport code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={!canFind || findLoading}
                onClick={() => void findFlights()}
              >
                <Plane className="mr-1.5 h-4 w-4" />
                {findLoading ? "Finding flights…" : "Find flight"}
              </Button>
              {findError ? (
                <p className="text-xs text-destructive">{findError}</p>
              ) : null}
              {hasSearched ? (
                <div className="rounded-[10px] border border-border bg-[var(--page-bg)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Known routes (OpenFlights)
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Nonstops and one-stop connections from scheduled airline
                    routes — not live fares or seat availability.
                  </p>
                  {findLoading ? (
                    <p className="mt-2 text-xs text-muted">Looking up routes…</p>
                  ) : itineraries.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      No nonstop or one-stop routes in OpenFlights for this
                      pair. You can still save the flight manually.
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
                      {itineraries.map((it) => (
                        <li key={it.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm hover:bg-brand-light"
                            onClick={() => applyItinerary(it)}
                          >
                            <span className="min-w-0">
                              <span className="font-semibold text-brand">
                                {it.airline}
                                {it.airline2 ? ` + ${it.airline2}` : ""}
                              </span>{" "}
                              <span className="text-foreground">
                                {it.airlineName !== it.airline
                                  ? it.airlineName
                                  : ""}
                                {it.airlineName2
                                  ? ` / ${it.airlineName2}`
                                  : ""}
                              </span>
                              {it.kind === "one_stop" && it.via ? (
                                <span className="mt-0.5 block text-xs text-muted">
                                  {it.from} → {it.via}
                                  {it.viaCity ? ` (${it.viaCity})` : ""} →{" "}
                                  {it.to}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-xs text-muted">
                              {it.kind === "nonstop"
                                ? "Nonstop"
                                : `1 stop · ${it.via}`}{" "}
                              · Add
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="depart">Depart date</Label>
                <Input
                  id="depart"
                  type="date"
                  value={form.departDate}
                  onChange={(e) => patch({ departDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="return">Return date</Label>
                <Input
                  id="return"
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => patch({ returnDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-[10px] border border-border bg-[var(--page-bg)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Cached cash fares (Flight MCP Open Cache)
              </p>
              <p className="text-[11px] text-muted">
                Anonymous weekly cache · 1 adult economy USD · routes:{" "}
                {FLIGHT_MCP_SUPPORTED_ROUTES.join(", ")}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canFind || !form.departDate || fareLoading}
                onClick={() => void searchCachedFares()}
              >
                {fareLoading ? "Searching cache…" : "Search cached fares"}
              </Button>
              {fareError ? (
                <p className="text-xs text-destructive">{fareError}</p>
              ) : null}
              {fareOffers.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-auto">
                  {fareOffers.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-sm hover:bg-brand-light"
                        onClick={() =>
                          patch({
                            airline: o.airline ?? form.airline,
                            flightNumber: o.flightNumber ?? "",
                            bookingUrl: o.bookingUrl ?? form.bookingUrl,
                            notes: o.staleLabel,
                            bookingStatus: "needs_booking",
                          })
                        }
                      >
                        <span>
                          <span className="font-semibold text-brand">
                            {o.airline ?? "Airline"}
                            {o.flightNumber ? ` ${o.flightNumber}` : ""}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {o.staleLabel}
                          </span>
                        </span>
                        <span className="text-xs font-bold">
                          {o.price != null
                            ? `${o.currency} ${o.price}`
                            : "Add"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {canFind ? (
                <a
                  href={seatsAeroSearchUrl({
                    origin: form.origin,
                    destination: form.destination,
                    departDate: form.departDate || null,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand underline-offset-2 hover:underline"
                >
                  Research awards on seats.aero (free website)
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pax">Passengers</Label>
                <Input
                  id="pax"
                  type="number"
                  min={1}
                  max={9}
                  value={form.passengers}
                  onChange={(e) =>
                    patch({ passengers: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="airline">Airline</Label>
                <select
                  id="airline"
                  className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                  value={form.airline}
                  onChange={(e) => patch({ airline: e.target.value })}
                >
                  <option value="">Any / TBD</option>
                  {AIRLINES.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                  {form.airline &&
                  !AIRLINES.some((a) => a.code === form.airline) ? (
                    <option value={form.airline}>{form.airline}</option>
                  ) : null}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flight-number">Flight #</Label>
                <Input
                  id="flight-number"
                  value={form.flightNumber}
                  placeholder="UA123"
                  onChange={(e) => patch({ flightNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="flight-status">Booking status</Label>
              <select
                id="flight-status"
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
              <Label htmlFor="flight-url">Booking URL (optional)</Label>
              <Input
                id="flight-url"
                type="url"
                placeholder="https://"
                value={form.bookingUrl}
                onChange={(e) => patch({ bookingUrl: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="flight-notes">Notes</Label>
              <Input
                id="flight-notes"
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => save()}>
                {form.id ? "Update flight" : "Save flight"}
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

        <section className="min-w-0 rounded-[12px] border border-border bg-card p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold">Your pending flights</h2>
          <p className="mt-0.5 text-xs text-muted">
            Status shows what still needs to be booked for each trip.
          </p>
          <div className="mt-3 space-y-3">
            {flights.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center">
                <Plane className="mx-auto h-8 w-8 text-brand/40" />
                <p className="mt-2 text-sm font-medium">No pending flights</p>
                <p className="text-xs text-muted">
                  Add a flight on the left to track booking for a trip.
                </p>
              </div>
            ) : (
              flights.map((f) => (
                <div
                  key={f.id}
                  className="rounded-[12px] border border-border bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold tracking-tight">
                        <span className="text-brand">{f.origin}</span>
                        <span className="mx-1.5 text-muted">→</span>
                        <span className="text-brand">{f.destination}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">
                        {[f.airline, f.flight_number].filter(Boolean).join(" ") ||
                          "Airline TBD"}
                      </p>
                      <p className="text-xs text-muted">
                        {tripLabel(f.trip_id)}
                        {f.depart_date ? ` · Depart ${f.depart_date}` : ""}
                        {f.return_date ? ` · Return ${f.return_date}` : ""}
                        {` · ${f.passengers} pax`}
                      </p>
                    </div>
                    <span
                      className={`rounded-[8px] border px-2 py-0.5 text-xs font-semibold ${bookingStatusClass(f.booking_status)}`}
                    >
                      {bookingStatusLabel(f.booking_status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setForm(rowToForm(f))}
                    >
                      Edit
                    </Button>
                    {f.booking_url ? (
                      <Button size="sm" variant="secondary" asChild>
                        <a
                          href={f.booking_url}
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
                          setFlights((prev) =>
                            prev.filter((x) => x.id !== f.id),
                          );
                          return;
                        }
                        startTransition(async () => {
                          await deletePendingFlightAction(f.id);
                          setFlights((prev) =>
                            prev.filter((x) => x.id !== f.id),
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
