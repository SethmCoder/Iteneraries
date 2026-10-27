"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Route,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  addItineraryItemAction,
  deleteItineraryItemAction,
  reorderItineraryItemsAction,
  updateItineraryItemAction,
} from "@/app/actions/itinerary";
import { updateTripAction } from "@/app/actions/trips";
import { WaypointMap, type MapRouteSegment } from "@/components/map/waypoint-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PoiPlace } from "@/lib/poi/types";
import type { ItineraryItem, Profile, Trip, TripMember } from "@/types/database";
import { TransportSegmentList } from "@/components/itinerary/transport-segments";
import { CollaboratorsPanel } from "@/components/itinerary/collaborators-panel";

type SuggestedItem = {
  title: string;
  description?: string;
  category: string;
  locationName?: string;
  startTime?: string;
  durationMinutes?: number;
};

type SuggestedItinerary = {
  days: Array<{ dayNumber: number; title?: string; items: SuggestedItem[] }>;
  notes?: string;
};

export function ItineraryWorkspace({
  trip,
  items: initialItems,
  members,
  role,
  currentUserId,
}: {
  trip: Trip;
  items: ItineraryItem[];
  members: (TripMember & { profiles: Profile | null })[];
  role: "owner" | "editor" | "viewer";
  currentUserId: string;
}) {
  const canEdit = role === "owner" || role === "editor";
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(trip.name ?? "");
  const [destination, setDestination] = useState(trip.destination_name ?? "");
  const [startDate, setStartDate] = useState(trip.start_date ?? "");
  const [endDate, setEndDate] = useState(trip.end_date ?? "");
  const [dateError, setDateError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    { display_name: string; lat: string; lon: string; name?: string }[]
  >([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedItinerary | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [routes, setRoutes] = useState<MapRouteSegment[]>([]);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const pins = useMemo(
    () =>
      items
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => ({
          id: i.id,
          lat: i.latitude!,
          lng: i.longitude!,
          title: i.title,
          subtitle: i.address,
        })),
    [items],
  );

  async function saveTripDetails() {
    if (startDate && endDate && endDate < startDate) {
      setDateError("End date cannot be earlier than start date");
      return;
    }
    setDateError(null);
    setSaving(true);
    try {
      await updateTripAction({
        tripId: trip.id,
        name: name.trim() || null,
        destination_name: destination.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function searchPlaces() {
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(searchQ)}`);
    if (!res.ok) return;
    const data = await res.json();
    setSearchResults(data.results ?? []);
  }

  async function addPlaceFromSearch(r: {
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }) {
    if (!canEdit) return;
    const result = await addItineraryItemAction({
      tripId: trip.id,
      title: r.name || r.display_name.split(",")[0],
      item_type: "place",
      location_name: r.name || r.display_name.split(",")[0],
      address: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    });
    if (result.item && "title" in result.item) {
      setItems((prev) => [...prev, result.item as ItineraryItem]);
    }
    setSearchResults([]);
    setSearchQ("");
  }

  async function addPoi(place: PoiPlace) {
    if (!canEdit) return;
    const result = await addItineraryItemAction({
      tripId: trip.id,
      title: place.name,
      item_type: "place",
      location_name: place.name,
      address: place.address ?? null,
      latitude: place.lat,
      longitude: place.lon,
      osm_id: `${place.osmType}/${place.osmId}`,
      details: { category: place.category, source: "overpass" },
    });
    if (!result.duplicate && result.item && "title" in result.item) {
      setItems((prev) => [...prev, result.item as ItineraryItem]);
    }
  }

  async function moveItem(id: string, direction: -1 | 1) {
    if (!canEdit) return;
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((i) => i.id === id);
    const swap = idx + direction;
    if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    setItems(ordered.map((item, i) => ({ ...item, sort_order: i + 1 })));
    await reorderItineraryItemsAction(
      trip.id,
      ordered.map((i) => i.id),
    );
  }

  async function confirmDelete() {
    if (!deleteId || !canEdit) return;
    await deleteItineraryItemAction(trip.id, deleteId);
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }

  async function makeRoute() {
    setRouteError(null);
    const ordered = [...items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((i) => i.latitude != null && i.longitude != null);

    if (ordered.length < 2) {
      setRouteError("Add at least two places with locations to build a route.");
      return;
    }

    setRouting(true);
    try {
      const segments: MapRouteSegment[] = [];
      const failures: string[] = [];

      for (let i = 0; i < ordered.length - 1; i++) {
        const from = ordered[i];
        const to = ordered[i + 1];
        const res = await fetch("/api/geo/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: { lat: from.latitude, lon: from.longitude },
            to: { lat: to.latitude, lon: to.longitude },
            mode: "car",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok || !Array.isArray(data.geometry) || !data.geometry.length) {
          failures.push(`${from.title} → ${to.title}`);
          // Straight-line fallback so the map still shows a connection
          segments.push({
            id: `${from.id}-${to.id}`,
            positions: [
              [from.latitude!, from.longitude!],
              [to.latitude!, to.longitude!],
            ],
            label: `${from.title} → ${to.title} (approximate)`,
          });
          continue;
        }

        const mins = Math.round((data.durationSeconds ?? 0) / 60);
        const km =
          typeof data.distanceMeters === "number"
            ? (data.distanceMeters / 1000).toFixed(1)
            : null;
        segments.push({
          id: `${from.id}-${to.id}`,
          positions: data.geometry as Array<[number, number]>,
          label: `${from.title} → ${to.title}${
            mins ? ` · ${mins} min` : ""
          }${km ? ` · ${km} km` : ""}`,
        });
      }

      setRoutes(segments);
      if (failures.length) {
        setRouteError(
          `Could not calculate full road routes for: ${failures.join(", ")}. Showing approximate lines where needed.`,
        );
      }
    } catch {
      setRouteError("Unable to build routes. Please try again.");
    } finally {
      setRouting(false);
    }
  }

  async function runSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggestion failed");
      setSuggestions(data as SuggestedItinerary);
    } catch (e) {
      setSuggestError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(dayNumber: number, item: SuggestedItem) {
    const result = await addItineraryItemAction({
      tripId: trip.id,
      title: item.title,
      item_type: "place",
      description: item.description ?? null,
      location_name: item.locationName ?? item.title,
      details: {
        ai: true,
        category: item.category,
        suggestedDay: dayNumber,
        startTime: item.startTime,
        durationMinutes: item.durationMinutes,
        note: "AI-generated recommendation — verify details before visiting.",
      },
    });
    if (result.item && "title" in result.item) {
      setItems((prev) => [...prev, result.item as ItineraryItem]);
    }
    setSuggestions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) =>
          d.dayNumber === dayNumber
            ? { ...d, items: d.items.filter((i) => i.title !== item.title) }
            : d,
        ),
      };
    });
  }

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="trip-name">Trip name</Label>
            <Input
              id="trip-name"
              value={name}
              disabled={!canEdit}
              placeholder="Untitled Trip"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => canEdit && void saveTripDetails()}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={destination}
              disabled={!canEdit}
              placeholder="City or region"
              onChange={(e) => setDestination(e.target.value)}
              onBlur={() => canEdit && void saveTripDetails()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              disabled={!canEdit}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={() => canEdit && void saveTripDetails()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End date</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              disabled={!canEdit}
              onChange={(e) => setEndDate(e.target.value)}
              onBlur={() => canEdit && void saveTripDetails()}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : null}
          {dateError ? (
            <span className="text-xs text-destructive">{dateError}</span>
          ) : null}
          <CollaboratorsPanel
            tripId={trip.id}
            members={members}
            role={role}
            currentUserId={currentUserId}
          />
          <Button
            variant="secondary"
            onClick={() => void makeRoute()}
            disabled={routing}
          >
            <Route className="h-4 w-4" />
            {routing ? "Building route…" : "Make route"}
          </Button>
          {routes.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setRoutes([]);
                setRouteError(null);
              }}
            >
              Clear route
            </Button>
          ) : null}
          {canEdit ? (
            <Button onClick={() => void runSuggest()} disabled={suggesting}>
              <Sparkles className="h-4 w-4" />
              {suggesting ? "Suggesting…" : "Suggest Itinerary"}
            </Button>
          ) : null}
        </div>
      </div>

      {routeError ? (
        <div className="rounded-[12px] border border-border bg-card p-3 text-sm text-warning">
          {routeError}
        </div>
      ) : null}

      {suggestError ? (
        <div className="rounded-[12px] border border-border bg-card p-3 text-sm text-destructive">
          {suggestError}{" "}
          <button type="button" className="underline" onClick={() => void runSuggest()}>
            Retry
          </button>
        </div>
      ) : null}

      {suggestions && suggestions.days.some((d) => d.items.length > 0) ? (
        <div className="rounded-[12px] border border-border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">AI suggestions</h2>
              <p className="text-xs text-muted">
                Recommendations are AI-generated. Verify details before adding.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setSuggestions(null)}>
              Dismiss all
            </Button>
          </div>
          {suggestions.notes ? (
            <p className="mb-3 text-sm text-muted">{suggestions.notes}</p>
          ) : null}
          <div className="space-y-4">
            {suggestions.days.map((day) =>
              day.items.length === 0 ? null : (
                <div key={day.dayNumber}>
                  <h3 className="mb-2 text-sm font-semibold">
                    Day {day.dayNumber}
                    {day.title ? ` · ${day.title}` : ""}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {day.items.map((item) => (
                      <div
                        key={`${day.dayNumber}-${item.title}`}
                        className="rounded-[10px] border border-border p-3"
                      >
                        <p className="font-semibold">{item.title}</p>
                        {item.description ? (
                          <p className="mt-1 text-sm text-muted">{item.description}</p>
                        ) : null}
                        <p className="mt-1 text-xs capitalize text-brand">
                          {item.category}
                          {item.locationName ? ` · ${item.locationName}` : ""}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => void acceptSuggestion(day.dayNumber, item)}
                          >
                            Add to Itinerary
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setSuggestions((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  days: prev.days.map((d) =>
                                    d.dayNumber === day.dayNumber
                                      ? {
                                          ...d,
                                          items: d.items.filter(
                                            (i) => i.title !== item.title,
                                          ),
                                        }
                                      : d,
                                  ),
                                };
                              })
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[42%_1fr]">
        <section className="space-y-3">
          {canEdit ? (
            <div className="rounded-[12px] border border-border bg-card p-3">
              <Label htmlFor="place-search">Add a place</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="place-search"
                  value={searchQ}
                  placeholder="Eiffel Tower, Paris"
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void searchPlaces()}
                />
                <Button type="button" onClick={() => void searchPlaces()}>
                  Search
                </Button>
              </div>
              {searchResults.length > 0 ? (
                <ul className="mt-2 max-h-40 overflow-auto rounded-[8px] border border-border">
                  {searchResults.map((r) => (
                    <li key={`${r.lat}-${r.lon}-${r.display_name}`}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-light"
                        onClick={() => void addPlaceFromSearch(r)}
                      >
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {sorted.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border bg-card p-8 text-center">
              <h2 className="font-semibold">Itinerary is empty</h2>
              <p className="mt-1 text-sm text-muted">
                Search for places or explore the map to add stops.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-brand-light pl-4">
              {sorted.map((item, index) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-[12px] border bg-card p-3 text-left shadow-sm transition-colors duration-150 ${
                      selectedId === item.id
                        ? "border-brand bg-brand-light"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {item.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="h-14 w-14 rounded-[8px] object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.title}</p>
                          <Badge className="capitalize">
                            {item.item_type.replace("_", " ")}
                          </Badge>
                        </div>
                        {item.address ? (
                          <p className="mt-0.5 text-xs text-muted">{item.address}</p>
                        ) : null}
                        {(item.start_at || item.end_at) && (
                          <p className="mt-1 text-xs text-muted">
                            {item.start_at
                              ? new Date(item.start_at).toLocaleString()
                              : ""}
                            {item.end_at
                              ? ` – ${new Date(item.end_at).toLocaleString()}`
                              : ""}
                          </p>
                        )}
                        {item.booking_reference ? (
                          <p className="mt-1 text-xs text-muted">
                            Ref: {item.booking_reference}
                          </p>
                        ) : null}
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-brand"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View reservation
                          </a>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveItem(item.id, -1);
                            }}
                            disabled={index === 0 || pending}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveItem(item.id, 1);
                            }}
                            disabled={index === sorted.length - 1 || pending}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(item.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div
                        className="mt-2 grid gap-2 sm:grid-cols-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          type="datetime-local"
                          defaultValue={
                            item.start_at
                              ? new Date(item.start_at).toISOString().slice(0, 16)
                              : ""
                          }
                          onBlur={(e) => {
                            const value = e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null;
                            startTransition(async () => {
                              const updated = await updateItineraryItemAction({
                                id: item.id,
                                tripId: trip.id,
                                start_at: value,
                              });
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === item.id ? updated.item : x,
                                ),
                              );
                            });
                          }}
                        />
                        <Input
                          type="datetime-local"
                          defaultValue={
                            item.end_at
                              ? new Date(item.end_at).toISOString().slice(0, 16)
                              : ""
                          }
                          onBlur={(e) => {
                            const value = e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null;
                            startTransition(async () => {
                              const updated = await updateItineraryItemAction({
                                id: item.id,
                                tripId: trip.id,
                                end_at: value,
                              });
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === item.id ? updated.item : x,
                                ),
                              );
                            });
                          }}
                        />
                      </div>
                    ) : null}
                  </button>
                  {index < sorted.length - 1 ? (
                    <TransportSegmentList
                      from={sorted[index]}
                      to={sorted[index + 1]}
                      tripId={trip.id}
                      canEdit={canEdit}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="min-h-[360px] lg:min-h-[calc(100vh-14rem)]">
          <WaypointMap
            pins={pins}
            selectedPinId={selectedId}
            onSelectPin={setSelectedId}
            tripId={trip.id}
            onAddPoi={canEdit ? addPoi : undefined}
            enablePoi
            routes={routes}
            height="100%"
          />
        </section>
      </div>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete itinerary item?</DialogTitle>
            <DialogDescription>
              This removes the item from the trip. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
