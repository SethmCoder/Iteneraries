"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { addItineraryItemAction } from "@/app/actions/itinerary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TripOption = {
  id: string;
  name: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
};

type PlaceListOption = {
  id: string;
  name: string;
  isShared?: boolean;
};

type SuggestedItem = {
  title: string;
  description?: string;
  category: string;
  locationName?: string;
  startTime?: string;
  durationMinutes?: number;
  hoursStatus?: string;
  source?: string;
  relevance?: string;
  osmId?: string | null;
  lat?: number | null;
  lon?: number | null;
  locked?: boolean;
};

type SuggestedDay = {
  dayNumber: number;
  title?: string;
  items: SuggestedItem[];
};

type Excluded = { title: string; reason: string };

type Draft = {
  id: string;
  label: string;
  reason: string;
  days: SuggestedDay[];
  notes?: string;
  excluded?: Excluded[];
};

function combineDateTime(
  tripStart: string | null | undefined,
  dayNumber: number,
  hm?: string,
): string | null {
  if (!tripStart || !hm) return null;
  const base = new Date(`${tripStart}T12:00:00Z`);
  if (!Number.isFinite(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + (dayNumber - 1));
  const [h, m] = hm.split(":").map(Number);
  base.setUTCHours(h ?? 0, m ?? 0, 0, 0);
  return base.toISOString();
}

export function ItinerarySuggesterWorkspace({
  trips,
  lists,
  initialListIds = [],
  initialTripId,
  initialMode = "full",
  initialMustDos = "",
  isDemo,
}: {
  trips: TripOption[];
  lists: PlaceListOption[];
  initialListIds?: string[];
  initialTripId?: string;
  initialMode?: "full" | "major" | "lesser";
  initialMustDos?: string;
  isDemo: boolean;
}) {
  const startTrip =
    trips.find((t) => t.id === initialTripId) ?? trips[0] ?? null;
  const [tripId, setTripId] = useState(startTrip?.id ?? "");
  const [destination, setDestination] = useState(
    startTrip?.destination_name ?? "",
  );
  const [startDate, setStartDate] = useState(startTrip?.start_date ?? "");
  const [endDate, setEndDate] = useState(startTrip?.end_date ?? "");
  const [pace, setPace] = useState("balanced");
  const [mustDos, setMustDos] = useState(initialMustDos);
  const [mode, setMode] = useState<"full" | "major" | "lesser">(initialMode);
  const [requiredMustDos, setRequiredMustDos] = useState(
    initialMode !== "lesser",
  );
  const [selectedLists, setSelectedLists] = useState<Set<string>>(
    () => new Set(initialListIds),
  );
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === tripId) ?? null,
    [trips, tripId],
  );

  function onTripChange(id: string) {
    setTripId(id);
    const t = trips.find((x) => x.id === id);
    if (t) {
      setDestination(t.destination_name ?? "");
      setStartDate(t.start_date ?? "");
      setEndDate(t.end_date ?? "");
    }
  }

  function mustDoList() {
    return mustDos
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function toggleList(id: string) {
    setSelectedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLock(draftId: string, dayNumber: number, index: number) {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draftId) return d;
        return {
          ...d,
          days: d.days.map((day) => {
            if (day.dayNumber !== dayNumber) return day;
            return {
              ...day,
              items: day.items.map((item, i) =>
                i === index ? { ...item, locked: !item.locked } : item,
              ),
            };
          }),
        };
      }),
    );
  }

  async function generate() {
    setError(null);
    setMessage(null);
    if (!tripId) {
      setError("Select a trip first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          mustDos: mustDoList(),
          listIds: mode === "major" ? [] : [...selectedLists],
          pace,
          mode,
          requiredMustDos: requiredMustDos ? mustDoList() : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Suggestion unavailable");
      }
      const days = (data.days ?? []) as SuggestedDay[];
      const notes = data.notes as string | undefined;
      const excluded = (data.excluded ?? []) as Excluded[];
      if (!days.length) {
        setDrafts([]);
        setError("No itinerary suggestions returned.");
        return;
      }
      const variants: Draft[] = [
        {
          id: "primary",
          label: data.source === "ai" ? "AI schedule" : "Scheduled draft",
          reason:
            "Must-Dos and selected lists, timed across the day. Meals and unscheduled gaps are labeled.",
          days,
          notes,
          excluded,
        },
      ];
      if (days.length > 1) {
        variants.push({
          id: "lighter",
          label: "Lighter days",
          reason: "Fewer non-meal stops per day.",
          days: days.map((d) => ({
            ...d,
            items: d.items.filter(
              (i, idx) =>
                i.source === "meal" ||
                i.locked ||
                idx < Math.ceil(d.items.length * 0.6),
            ),
          })),
          notes,
          excluded,
        });
      }
      setDrafts(variants);
      setSelectedDraftId(variants[0]?.id ?? null);
      if (data.source === "deterministic" || data.source === "deterministic_fallback") {
        setMessage(
          data.source === "deterministic"
            ? "Built a timed schedule without AI (OPENAI_API_KEY not set)."
            : "AI unavailable — used the deterministic scheduler.",
        );
      }
    } catch (e) {
      setDrafts([]);
      setError((e as Error).message || "Could not generate suggestions");
    } finally {
      setLoading(false);
    }
  }

  function addDraftToTrip(draft: Draft) {
    if (!tripId) {
      setError("Select a destination trip first");
      return;
    }
    const dedupeKey = `${tripId}:${draft.id}`;
    if (addedKeys.has(dedupeKey)) {
      setMessage("This draft was already added to the trip.");
      return;
    }

    const toAdd = draft.days.flatMap((d) =>
      d.items
        .filter((item) => item.source !== "unscheduled")
        .map((item) => ({ day: d.dayNumber, item })),
    );

    if (toAdd.length === 0) {
      setError("Nothing to add from this draft");
      return;
    }

    if (isDemo) {
      setAddedKeys((prev) => new Set(prev).add(dedupeKey));
      setMessage(`Preview: would add ${toAdd.length} stops to the trip.`);
      return;
    }

    startTransition(async () => {
      try {
        for (const { day, item } of toAdd) {
          const start_at = combineDateTime(
            startDate || selectedTrip?.start_date,
            day,
            item.startTime,
          );
          let end_at: string | null = null;
          if (start_at && item.durationMinutes) {
            end_at = new Date(
              Date.parse(start_at) + item.durationMinutes * 60_000,
            ).toISOString();
          }
          await addItineraryItemAction({
            tripId,
            title: item.title,
            item_type: "place",
            location_name: item.locationName ?? item.title,
            latitude: item.lat ?? null,
            longitude: item.lon ?? null,
            start_at,
            end_at,
            osm_id: item.osmId ?? null,
            details: {
              source: "itinerary_suggester",
              draftId: draft.id,
              category: item.category,
              description: item.description ?? null,
              suggested: true,
              hoursStatus: item.hoursStatus ?? null,
              relevance: item.relevance ?? null,
              locked: item.locked ?? false,
            },
          });
        }
        setAddedKeys((prev) => new Set(prev).add(dedupeKey));
        setMessage(
          `Added ${toAdd.length} suggested stops. Review them on the trip itinerary.`,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const selectedDraft = drafts.find((d) => d.id === selectedDraftId) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Itinerary Suggester</h1>
        <p className="mt-1 text-sm text-muted">
          Generate timed draft itineraries from Must-Dos and Saved Places.
          Drafts are not saved until you click Add to Itinerary.
        </p>
      </div>

      {message ? (
        <p className="text-sm text-success">
          {message}
          {tripId && addedKeys.size > 0 ? (
            <>
              {" "}
              <Link className="font-semibold underline" href={`/trips/${tripId}`}>
                Open trip itinerary
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-4 rounded-[12px] border border-border bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="trip">Trip</Label>
          <select
            id="trip"
            className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
            value={tripId}
            onChange={(e) => onTripChange(e.target.value)}
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
          <Label htmlFor="mode">Planning mode</Label>
          <select
            id="mode"
            className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as "full" | "major" | "lesser")
            }
          >
            <option value="full">Full day plan</option>
            <option value="major">Major activities only</option>
            <option value="lesser">Lesser activities (fill gaps)</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dest">Destination</Label>
            <Input
              id="dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pace">Pace</Label>
            <select
              id="pace"
              className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
              value={pace}
              onChange={(e) => setPace(e.target.value)}
            >
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="packed">Packed</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="must">Must-dos (comma-separated)</Label>
          <Input
            id="must"
            value={mustDos}
            onChange={(e) => setMustDos(e.target.value)}
            placeholder="Eiffel Tower, Louvre"
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={requiredMustDos}
              onChange={(e) => setRequiredMustDos(e.target.checked)}
            />
            Treat Must-Dos as required (flag if they cannot be scheduled)
          </label>
        </div>
        {lists.length > 0 ? (
          <div className="space-y-2">
            <Label>Saved Places lists to include</Label>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleList(l.id)}
                  className={`rounded-[8px] border px-3 py-1.5 text-sm ${
                    selectedLists.has(l.id)
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-muted"
                  }`}
                >
                  {l.name}
                  {l.isShared ? " (shared)" : ""}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              <Link href="/saved-places" className="text-brand underline">
                Manage Saved Places
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">
            No Saved Places lists yet.{" "}
            <Link href="/saved-places" className="text-brand underline">
              Create one
            </Link>
          </p>
        )}
        <Button disabled={loading || !tripId} onClick={() => void generate()}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating…" : "Generate drafts"}
        </Button>
      </section>

      {drafts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {drafts.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDraftId(d.id)}
              className={`rounded-[12px] border p-3 text-left shadow-sm ${
                selectedDraftId === d.id
                  ? "border-brand bg-brand-light"
                  : "border-border bg-card"
              }`}
            >
              <p className="font-semibold">{d.label}</p>
              <p className="mt-1 text-xs text-muted">{d.reason}</p>
            </button>
          ))}
        </div>
      ) : null}

      {selectedDraft ? (
        <section className="space-y-4">
          {selectedDraft.notes ? (
            <p className="text-sm text-muted">{selectedDraft.notes}</p>
          ) : null}
          {selectedDraft.excluded && selectedDraft.excluded.length > 0 ? (
            <div className="rounded-[12px] border border-warning/40 bg-warning/5 p-3 text-sm">
              <p className="font-semibold">Could not fit</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {selectedDraft.excluded.map((e) => (
                  <li key={`${e.title}-${e.reason}`}>
                    <span className="font-medium">{e.title}</span> — {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {selectedDraft.days.map((day) => (
            <div key={day.dayNumber} className="space-y-2">
              <h2 className="font-semibold">
                {day.title || `Day ${day.dayNumber}`}
              </h2>
              <ul className="space-y-2">
                {day.items.map((item, idx) => (
                  <li
                    key={`${day.dayNumber}-${idx}-${item.title}`}
                    className="rounded-[12px] border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.description ? (
                          <p className="text-sm text-muted">{item.description}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-brand">
                          {[
                            item.startTime,
                            item.durationMinutes
                              ? `${item.durationMinutes} min`
                              : null,
                            item.category,
                            item.locationName,
                            item.hoursStatus === "unknown"
                              ? "hours unverified"
                              : item.hoursStatus === "verified"
                                ? "hours verified"
                                : null,
                            item.relevance,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          toggleLock(selectedDraft.id, day.dayNumber, idx)
                        }
                      >
                        {item.locked ? "Locked" : "Lock"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Button
            disabled={pending}
            onClick={() => addDraftToTrip(selectedDraft)}
          >
            {pending ? "Adding…" : "Add to Itinerary"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
