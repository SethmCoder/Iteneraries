"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  List,
  Loader2,
  Building2,
  Map as MapIcon,
  Plane,
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
import { DEMO_TRIP_ID } from "@/lib/demo-config";
import {
  formatCardDate,
  formatCardTime,
  formatDayHeading,
  groupItemsByDay,
  sortedDayKeys,
  toDatetimeLocalValue,
} from "@/lib/itinerary-time";
import type { PoiPlace } from "@/lib/poi/types";
import type { ItineraryItem, Profile, Trip, TripMember } from "@/types/database";
import { ActivityTypePicker } from "@/components/itinerary/activity-type-picker";
import { TripConflictsPanel } from "@/components/itinerary/trip-conflicts-panel";
import {
  PlanningProgress,
  phaseFromStage,
} from "@/components/itinerary/planning-progress";
import { TransportSegmentList } from "@/components/itinerary/transport-segments";
import { CollaboratorsPanel } from "@/components/itinerary/collaborators-panel";
import { TripForwardEmail } from "@/components/itinerary/trip-forward-email";
import { detectTripConflicts } from "@/lib/itinerary/conflicts";
import {
  deriveStageStatuses,
  parsePlanningProfile,
  type PlanningProfile,
  type PlanningStageId,
} from "@/lib/itinerary/planning-profile";
import {
  getActivityType,
  type ActivityTypeId,
} from "@/lib/itinerary/activity-types";
import { savePendingActivityAction } from "@/app/actions/pending-bookings";
import type { PendingFlight, PendingHotel } from "@/types/database";

type TripSection =
  | "overview"
  | "itinerary"
  | "flights"
  | "hotels"
  | "activities"
  | "bookings";

const TRIP_SECTIONS: { id: TripSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "flights", label: "Flights" },
  { id: "hotels", label: "Hotels" },
  { id: "activities", label: "Activities" },
  { id: "bookings", label: "Bookings" },
];

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
  forwardEmail,
  pendingFlights = [],
  pendingHotels = [],
}: {
  trip: Trip;
  items: ItineraryItem[];
  members: (TripMember & { profiles: Profile | null })[];
  role: "owner" | "editor" | "viewer";
  currentUserId: string;
  forwardEmail?: { configured: boolean; address: string | null };
  pendingFlights?: PendingFlight[];
  pendingHotels?: PendingHotel[];
}) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const isDemoTrip = trip.id === DEMO_TRIP_ID;
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
    { display_name: string; lat: number | string; lon: number | string; name?: string }[]
  >([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [activityType, setActivityType] = useState<ActivityTypeId>("sightseeing");
  const [tripSection, setTripSection] = useState<TripSection>("itinerary");
  /** Narrow screens: show itinerary or map one at a time instead of squeezed columns. */
  const [mobilePane, setMobilePane] = useState<"itinerary" | "map">("itinerary");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedItinerary | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [routes, setRoutes] = useState<MapRouteSegment[]>([]);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "days">("days");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [planningProfile, setPlanningProfile] = useState<PlanningProfile>(() =>
    parsePlanningProfile(trip.planning_profile),
  );
  const [activityTitle, setActivityTitle] = useState("");
  const [activityLocation, setActivityLocation] = useState("");

  const stageStatuses = useMemo(
    () =>
      deriveStageStatuses({
        profile: planningProfile,
        flights: pendingFlights,
        hotels: pendingHotels,
        items: items.map((i) => ({
          title: i.title,
          details: i.details,
          start_at: i.start_at,
        })),
      }),
    [planningProfile, pendingFlights, pendingHotels, items],
  );

  async function persistPlanningProfile(next: PlanningProfile) {
    setPlanningProfile(next);
    if (!canEdit || isDemoTrip) return;
    await updateTripAction({
      tripId: trip.id,
      planning_profile: next,
    });
  }

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  const dayGroups = useMemo(() => groupItemsByDay(sorted), [sorted]);
  const dayKeys = useMemo(() => sortedDayKeys(dayGroups), [dayGroups]);

  const visibleItems = useMemo(() => {
    if (viewMode === "all") return sorted;
    if (selectedDay === "all") return sorted;
    return dayGroups.get(selectedDay) ?? [];
  }, [viewMode, selectedDay, sorted, dayGroups]);

  const pins = useMemo(
    () =>
      visibleItems
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => ({
          id: i.id,
          lat: i.latitude!,
          lng: i.longitude!,
          title: i.title,
          subtitle: i.address,
          osmId: i.osm_id,
        })),
    [visibleItems],
  );

  const conflicts = useMemo(
    () =>
      detectTripConflicts({
        items,
        flights: pendingFlights,
        hotels: pendingHotels,
      }),
    [items, pendingFlights, pendingHotels],
  );

  async function saveTripDetails() {
    if (startDate && endDate && endDate < startDate) {
      setDateError("End date cannot be earlier than start date");
      return;
    }
    setDateError(null);
    if (isDemoTrip) return;
    setSaving(true);
    try {
      await updateTripAction({
        tripId: trip.id,
        name: name.trim() || null,
        destination_name: destination.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      // Refresh so the trip forward address (+slug) stays in sync with the name.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function createLocalItem(
    partial: Partial<ItineraryItem> & { title: string },
  ): ItineraryItem {
    const now = new Date().toISOString();
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0);
    return {
      id: crypto.randomUUID(),
      trip_id: trip.id,
      created_by: currentUserId,
      item_type: partial.item_type ?? "place",
      title: partial.title,
      description: partial.description ?? null,
      location_name: partial.location_name ?? partial.title,
      address: partial.address ?? null,
      latitude: partial.latitude ?? null,
      longitude: partial.longitude ?? null,
      start_at: partial.start_at ?? null,
      end_at: partial.end_at ?? null,
      timezone: partial.timezone ?? trip.timezone,
      sort_order: partial.sort_order ?? maxOrder + 1,
      booking_reference: partial.booking_reference ?? null,
      source_url: partial.source_url ?? null,
      thumbnail_url: partial.thumbnail_url ?? null,
      details: partial.details ?? {},
      osm_id: partial.osm_id ?? null,
      created_at: now,
      updated_at: now,
    };
  }

  async function searchPlaces() {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchError("Enter at least 2 characters.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed");
      const results = data.results ?? [];
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No places found. Try a more specific name.");
      }
    } catch (e) {
      setSearchResults([]);
      setSearchError((e as Error).message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addPlaceFromSearch(r: {
    display_name: string;
    lat: number | string;
    lon: number | string;
    name?: string;
  }) {
    if (!canEdit) return;
    const title = r.name || r.display_name.split(",")[0];
    const latitude = Number(r.lat);
    const longitude = Number(r.lon);

    const typeMeta = getActivityType(activityType);
    if (isDemoTrip) {
      setItems((prev) => [
        ...prev,
        createLocalItem({
          title,
          item_type: typeMeta.itemType,
          location_name: title,
          address: r.display_name,
          latitude,
          longitude,
          details: {
            source: "search",
            preview: true,
            activityType: typeMeta.id,
            category: typeMeta.category,
          },
        }),
      ]);
      setSearchResults([]);
      setSearchQ("");
      setSearchError(null);
      return;
    }

    try {
      const result = await addItineraryItemAction({
        tripId: trip.id,
        title,
        item_type: typeMeta.itemType,
        location_name: title,
        address: r.display_name,
        latitude,
        longitude,
        details: {
          activityType: typeMeta.id,
          category: typeMeta.category,
        },
      });
      if (result.item && "title" in result.item) {
        setItems((prev) => [...prev, result.item as ItineraryItem]);
      }
      setSearchResults([]);
      setSearchQ("");
      setSearchError(null);
    } catch (e) {
      setSearchError((e as Error).message || "Could not add place");
    }
  }

  async function addPoi(place: PoiPlace) {
    if (!canEdit) return;
    if (isDemoTrip) {
      setItems((prev) => {
        if (prev.some((i) => i.osm_id === `${place.osmType}/${place.osmId}`)) {
          return prev;
        }
        return [
          ...prev,
          createLocalItem({
            title: place.name,
            location_name: place.name,
            address: place.address ?? null,
            latitude: place.lat,
            longitude: place.lon,
            osm_id: `${place.osmType}/${place.osmId}`,
            details: { category: place.category, source: "overpass", preview: true },
          }),
        ];
      });
      return;
    }
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

  async function saveItemTimes(
    itemId: string,
    patch: { start_at?: string | null; end_at?: string | null },
  ) {
    if (isDemoTrip) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, ...patch, updated_at: new Date().toISOString() } : item,
        ),
      );
      return;
    }
    const updated = await updateItineraryItemAction({
      id: itemId,
      tripId: trip.id,
      ...patch,
    });
    setItems((prev) =>
      prev.map((x) => (x.id === itemId ? updated.item : x)),
    );
  }

  async function moveItem(id: string, direction: -1 | 1) {
    if (!canEdit) return;
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((i) => i.id === id);
    const swap = idx + direction;
    if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    const next = ordered.map((item, i) => ({ ...item, sort_order: i + 1 }));
    setItems(next);
    if (!isDemoTrip) {
      await reorderItineraryItemsAction(
        trip.id,
        next.map((i) => i.id),
      );
    }
  }

  async function confirmDelete() {
    if (!deleteId || !canEdit) return;
    if (!isDemoTrip) {
      await deleteItineraryItemAction(trip.id, deleteId);
    }
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
    if (isDemoTrip) {
      setItems((prev) => [
        ...prev,
        createLocalItem({
          title: item.title,
          description: item.description ?? null,
          location_name: item.locationName ?? item.title,
          details: {
            ai: true,
            category: item.category,
            suggestedDay: dayNumber,
            startTime: item.startTime,
            durationMinutes: item.durationMinutes,
            note: "AI-generated recommendation — verify details before visiting.",
            preview: true,
          },
        }),
      ]);
    } else {
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

  return (
    <div className="space-y-4">
      <TripForwardEmail
        address={forwardEmail?.address ?? null}
        configured={Boolean(forwardEmail?.configured)}
        tripName={name}
      />
      <TripConflictsPanel conflicts={conflicts} />
      <PlanningProgress
        tripId={trip.id}
        profile={planningProfile}
        statuses={stageStatuses}
        activeStage={
          tripSection === "activities"
            ? "major_activities"
            : tripSection === "overview"
              ? "overview"
              : tripSection === "itinerary"
                ? "itinerary"
                : "itinerary"
        }
        pending={pending}
        onSelectStage={(stage: PlanningStageId) => {
          if (stage === "flights") {
            window.location.href = `/flights?tripId=${trip.id}&from=plan`;
            return;
          }
          if (stage === "hotels") {
            window.location.href = `/hotels?tripId=${trip.id}&from=plan`;
            return;
          }
          if (stage === "major_activities") {
            setTripSection("activities");
            return;
          }
          setTripSection("itinerary");
        }}
        onSkipStage={(stage) => {
          startTransition(async () => {
            const skipped = [
              ...(planningProfile.skippedPhases ?? []).filter((p) => p !== stage),
              stage,
            ];
            const order: PlanningStageId[] = [
              "flights",
              "major_activities",
              "hotels",
              "lesser_activities",
            ];
            const idx = order.indexOf(stage);
            const nextPhase =
              idx >= 0 && idx < order.length - 1
                ? phaseFromStage(order[idx + 1]!)
                : "done";
            await persistPlanningProfile({
              ...planningProfile,
              skippedPhases: skipped,
              guidedPhase: nextPhase,
            });
          });
        }}
        onMarkDone={() => {
          startTransition(async () => {
            await persistPlanningProfile({
              ...planningProfile,
              guidedPhase: "done",
            });
          });
        }}
      />
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
            <Label htmlFor="start" className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand" />
              Trip starts
            </Label>
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
            <Label htmlFor="end" className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand" />
              Trip ends
            </Label>
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
          <Button variant="secondary" asChild>
            <Link href={`/flights?tripId=${trip.id}`}>
              <Plane className="h-4 w-4" />
              Flights Pending
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/hotels?tripId=${trip.id}`}>
              <Building2 className="h-4 w-4" />
              Hotels Pending
            </Link>
          </Button>
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

      <nav
        className="scrollbar-none flex gap-1 overflow-x-auto rounded-[12px] border border-border bg-card p-1.5 shadow-sm"
        aria-label="Trip sections"
      >
        {TRIP_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => {
              if (section.id === "flights") {
                window.location.href = `/flights?tripId=${trip.id}&from=plan`;
                return;
              }
              if (section.id === "hotels") {
                window.location.href = `/hotels?tripId=${trip.id}&from=plan`;
                return;
              }
              if (section.id === "bookings") {
                window.location.href = `/bookings?tripId=${trip.id}`;
                return;
              }
              setTripSection(section.id);
            }}
            className={`shrink-0 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors ${
              tripSection === section.id
                ? "bg-brand text-white"
                : "text-muted hover:bg-brand-light hover:text-brand"
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>

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

      {tripSection === "overview" ? (
        <section className="space-y-3 rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Planning overview</h2>
          <p className="text-sm text-muted">
            Confirmed bookings, saved options, and suggested stops for this trip.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[10px] border border-border p-3">
              <p className="text-xs font-semibold uppercase text-muted">Flights</p>
              <p className="mt-1 text-sm font-semibold">
                {pendingFlights.filter((f) => f.booking_status === "booked").length}{" "}
                confirmed · {pendingFlights.length} total
              </p>
              <Button size="sm" variant="secondary" className="mt-2" asChild>
                <Link href={`/flights?tripId=${trip.id}&from=plan`}>Manage</Link>
              </Button>
            </div>
            <div className="rounded-[10px] border border-border p-3">
              <p className="text-xs font-semibold uppercase text-muted">Hotels</p>
              <p className="mt-1 text-sm font-semibold">
                {pendingHotels.filter((h) => h.booking_status === "booked").length}{" "}
                confirmed · {pendingHotels.length} total
              </p>
              <Button size="sm" variant="secondary" className="mt-2" asChild>
                <Link href={`/hotels?tripId=${trip.id}&from=plan`}>Manage</Link>
              </Button>
            </div>
            <div className="rounded-[10px] border border-border p-3">
              <p className="text-xs font-semibold uppercase text-muted">Itinerary</p>
              <p className="mt-1 text-sm font-semibold">{items.length} stops</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => setTripSection("itinerary")}
              >
                Open itinerary
              </Button>
            </div>
          </div>
          {(planningProfile.mustDos?.length ?? 0) > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Must-dos</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {planningProfile.mustDos!.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {tripSection === "activities" ? (
        <section className="space-y-3 rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Major activities</h2>
              <p className="text-sm text-muted">
                Lock Must-Dos and bookable experiences before choosing a hotel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={`/suggester?tripId=${trip.id}&mode=major`}>
                  Suggest majors
                </Link>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link href="/saved-places">Saved Places</Link>
              </Button>
            </div>
          </div>
          {(planningProfile.mustDos?.length ?? 0) > 0 ? (
            <ul className="space-y-1 text-sm">
              {planningProfile.mustDos!.map((m) => (
                <li
                  key={m}
                  className="rounded-[8px] border border-accent/40 bg-accent/15 px-3 py-2"
                >
                  <span className="font-medium">{m}</span>
                  <span className="ml-2 text-xs text-muted">required</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No Must-Dos yet. Add them in trip setup or the Itinerary Suggester.
            </p>
          )}
          {canEdit ? (
            <div className="space-y-2 rounded-[10px] border border-border p-3">
              <p className="text-sm font-semibold">Track a bookable activity</p>
              <Input
                placeholder="Title (e.g. Louvre tickets)"
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
              />
              <Input
                placeholder="Location (optional)"
                value={activityLocation}
                onChange={(e) => setActivityLocation(e.target.value)}
              />
              <Button
                size="sm"
                disabled={pending || !activityTitle.trim() || isDemoTrip}
                onClick={() =>
                  startTransition(async () => {
                    await savePendingActivityAction({
                      tripId: trip.id,
                      title: activityTitle.trim(),
                      activityType: "attraction",
                      location: activityLocation.trim() || null,
                      bookingStatus: "needs_booking",
                    });
                    setActivityTitle("");
                    setActivityLocation("");
                    await persistPlanningProfile({
                      ...planningProfile,
                      guidedPhase: "major_activities",
                    });
                    router.refresh();
                  })
                }
              >
                Save to bookings checklist
              </Button>
            </div>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => setTripSection("itinerary")}
          >
            Continue to itinerary / lesser activities
          </Button>
        </section>
      ) : null}

      {tripSection === "itinerary" ||
      !["overview", "activities"].includes(tripSection) ? (
      <>
      <div
        className="flex gap-1 rounded-[12px] border border-border bg-card p-1 lg:hidden"
        role="tablist"
        aria-label="Itinerary or map"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "itinerary"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-colors ${
            mobilePane === "itinerary"
              ? "bg-brand text-white"
              : "text-muted hover:bg-brand-light hover:text-brand"
          }`}
          onClick={() => setMobilePane("itinerary")}
        >
          <List className="h-4 w-4" />
          Itinerary
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

      <div className="grid gap-4 lg:grid-cols-[42%_1fr] lg:items-start">
        <section
          className={`order-2 space-y-3 lg:order-1 ${
            mobilePane === "itinerary" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="rounded-[12px] border border-border bg-card p-3">
            <h2 className="text-base font-semibold">Your itinerary</h2>
            <p className="mt-0.5 text-xs text-muted">
              Stops for this trip live here — add places, set times, and switch between day and list views.
            </p>
          </div>
          {canEdit ? (
            <div className="rounded-[12px] border border-border bg-card p-3">
              <Label>Add to itinerary</Label>
              <p className="mt-0.5 text-xs text-muted">
                Pick a type, then search for a place. This plans a stop — it does
                not confirm a booking.
              </p>
              <div className="mt-2 space-y-2">
                <ActivityTypePicker
                  value={activityType}
                  onChange={setActivityType}
                />
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <Input
                    id="place-search"
                    className="min-w-0 flex-1"
                    value={searchQ}
                    placeholder={
                      activityType === "dining" || activityType === "restaurant"
                        ? "Restaurant name or address"
                        : activityType === "meeting"
                          ? "Meeting location"
                          : activityType === "hotel" ||
                              activityType === "resort" ||
                              activityType === "vacation_rental"
                            ? "Hotel or stay name"
                            : activityType === "flight"
                              ? "Airport or flight"
                              : "Place name or address"
                    }
                    onChange={(e) => {
                      setSearchQ(e.target.value);
                      setSearchError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void searchPlaces()}
                  />
                  <Button
                    type="button"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={searching}
                    onClick={() => void searchPlaces()}
                  >
                    {searching ? "…" : "Search"}
                  </Button>
                </div>
              </div>
              {searchError ? (
                <p className="mt-2 text-sm text-destructive">{searchError}</p>
              ) : null}
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

          <div className="rounded-[12px] border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm font-semibold">Itinerary view</p>
              <Button
                size="sm"
                variant={viewMode === "all" ? "default" : "secondary"}
                className="min-h-9"
                onClick={() => {
                  setViewMode("all");
                  setSelectedDay("all");
                }}
              >
                <List className="h-3.5 w-3.5" />
                All stops
              </Button>
              <Button
                size="sm"
                variant={viewMode === "days" ? "default" : "secondary"}
                className="min-h-9"
                onClick={() => setViewMode("days")}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                By day
              </Button>
            </div>
            {viewMode === "days" ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDay("all")}
                  className={`rounded-[8px] border px-2.5 py-1 text-xs font-medium ${
                    selectedDay === "all"
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-muted"
                  }`}
                >
                  All days
                </button>
                {dayKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    className={`rounded-[8px] border px-2.5 py-1 text-xs font-medium ${
                      selectedDay === key
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-white text-muted"
                    }`}
                  >
                    {key === "unscheduled"
                      ? "Unscheduled"
                      : formatCardDate(`${key}T12:00:00`)}
                    <span className="ml-1 opacity-70">
                      ({dayGroups.get(key)?.length ?? 0})
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border bg-card p-8 text-center">
              <h2 className="font-semibold">Itinerary is empty</h2>
              <p className="mt-1 text-sm text-muted">
                Use Add a place above, or tap a map pin, to add stops.
              </p>
            </div>
          ) : viewMode === "days" && selectedDay === "all" ? (
            <div className="space-y-6">
              {dayKeys.map((dayKey) => {
                const dayItems = dayGroups.get(dayKey) ?? [];
                return (
                  <div key={dayKey} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground">
                        {formatDayHeading(dayKey)}
                      </h3>
                      <button
                        type="button"
                        className="text-xs font-medium text-brand"
                        onClick={() => setSelectedDay(dayKey)}
                      >
                        Focus day
                      </button>
                    </div>
                    <TimelineList
                      items={dayItems}
                      selectedId={selectedId}
                      canEdit={canEdit}
                      pending={pending}
                      tripId={trip.id}
                      onSelect={setSelectedId}
                      onMoveUp={(id) => void moveItem(id, -1)}
                      onMoveDown={(id) => void moveItem(id, 1)}
                      onDelete={setDeleteId}
                      onSaveTimes={(id, patch) =>
                        startTransition(() => saveItemTimes(id, patch))
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <TimelineList
              items={visibleItems}
              selectedId={selectedId}
              canEdit={canEdit}
              pending={pending}
              tripId={trip.id}
              onSelect={setSelectedId}
              onMoveUp={(id) => void moveItem(id, -1)}
              onMoveDown={(id) => void moveItem(id, 1)}
              onDelete={setDeleteId}
              onSaveTimes={(id, patch) =>
                startTransition(() => saveItemTimes(id, patch))
              }
            />
          )}
        </section>

        <section
          className={`order-1 min-h-0 lg:order-2 lg:sticky lg:top-20 lg:min-h-[calc(100vh-8rem)] ${
            mobilePane === "map" ? "block" : "hidden lg:block"
          }`}
        >
          <p className="mb-2 text-sm font-semibold text-foreground">Trip map</p>
          <p className="mb-2 text-xs text-muted lg:block">
            <span className="lg:hidden">
              Pins and routes for stops in your current view.
            </span>
            <span className="hidden lg:inline">
              Pins and routes for the stops in your current view. Scroll down for
              the itinerary list.
            </span>
          </p>
          <div className="h-[min(70vh,32rem)] min-h-[280px] w-full lg:h-[calc(100vh-10rem)]">
            <WaypointMap
              pins={pins}
              selectedPinId={selectedId}
              onSelectPin={(id) => {
                setSelectedId(id);
                if (id) setMobilePane("itinerary");
              }}
              tripId={trip.id}
              onAddPoi={canEdit ? addPoi : undefined}
              enablePoi
              routes={routes}
              height="100%"
            />
          </div>
        </section>
      </div>
      </>
      ) : null}

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

function formatStopWhen(item: ItineraryItem): string {
  if (!item.start_at) return "Time not set";
  const start = formatCardTime(item.start_at);
  const date = formatCardDate(item.start_at);
  const end = item.end_at ? formatCardTime(item.end_at) : null;
  if (end) return `${start} – ${end}${date ? ` · ${date}` : ""}`;
  return `${start}${date ? ` · ${date}` : ""}`;
}

function TimelineList({
  items,
  selectedId,
  canEdit,
  pending,
  tripId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSaveTimes,
}: {
  items: ItineraryItem[];
  selectedId: string | null;
  canEdit: boolean;
  pending: boolean;
  tripId: string;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveTimes: (
    id: string,
    patch: { start_at?: string | null; end_at?: string | null },
  ) => void;
}) {
  return (
    <ol className="relative">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const selected = selectedId === item.id;
        return (
          <li key={item.id} className="relative flex gap-3">
            <div
              className="relative flex w-4 shrink-0 justify-center"
              aria-hidden
            >
              {!isFirst ? (
                <span className="absolute inset-x-1/2 top-0 h-3.5 w-0.5 -translate-x-1/2 bg-brand/30" />
              ) : null}
              <span
                className={`relative z-10 mt-3.5 h-2.5 w-2.5 rounded-full border-2 border-brand ${
                  selected ? "bg-brand" : "bg-white"
                }`}
              />
              {!isLast ? (
                <span className="absolute inset-x-1/2 top-6 bottom-0 w-0.5 -translate-x-1/2 bg-brand/30" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <ItineraryCard
                item={item}
                selected={selected}
                canEdit={canEdit}
                pending={pending}
                isFirst={isFirst}
                isLast={isLast}
                onSelect={() => onSelect(item.id)}
                onMoveUp={() => onMoveUp(item.id)}
                onMoveDown={() => onMoveDown(item.id)}
                onDelete={() => onDelete(item.id)}
                onSaveTimes={(patch) => onSaveTimes(item.id, patch)}
              />
              {!isLast ? (
                <TransportSegmentList
                  from={item}
                  to={items[index + 1]}
                  tripId={tripId}
                  canEdit={canEdit}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ItineraryCard({
  item,
  selected,
  canEdit,
  pending,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSaveTimes,
}: {
  item: ItineraryItem;
  selected: boolean;
  canEdit: boolean;
  pending: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSaveTimes: (patch: {
    start_at?: string | null;
    end_at?: string | null;
  }) => void;
}) {
  return (
    <div
      className={`rounded-[12px] border bg-card shadow-sm transition-colors duration-150 ${
        selected ? "border-brand bg-brand-light" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full gap-3 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {item.title}
            </p>
            <Badge className="capitalize">
              {item.item_type.replace("_", " ")}
            </Badge>
          </div>
          {item.address ? (
            <p className="mt-0.5 truncate text-sm text-muted">{item.address}</p>
          ) : item.location_name && item.location_name !== item.title ? (
            <p className="mt-0.5 truncate text-sm text-muted">
              {item.location_name}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted">{formatStopWhen(item)}</p>
          {item.booking_reference ? (
            <p className="mt-1 text-xs text-muted">
              Ref: {item.booking_reference}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div
            className="flex shrink-0 flex-col gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onMoveUp}
              disabled={isFirst || pending}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onMoveDown}
              disabled={isLast || pending}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </button>
      {canEdit && selected ? (
        <div className="grid gap-2 border-t border-border px-3 py-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted">Starts</Label>
            <Input
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(item.start_at)}
              onBlur={(e) => {
                const value = e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null;
                onSaveTimes({ start_at: value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted">Ends</Label>
            <Input
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(item.end_at)}
              onBlur={(e) => {
                const value = e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null;
                onSaveTimes({ end_at: value });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
