"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { addItineraryItemAction } from "@/app/actions/itinerary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildDeterministicDrafts } from "@/lib/itinerary/deterministic-drafts";

type TripOption = {
  id: string;
  name: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
};

type SuggestedItem = {
  title: string;
  description?: string;
  category: string;
  locationName?: string;
  startTime?: string;
  durationMinutes?: number;
};

type SuggestedDay = {
  dayNumber: number;
  title?: string;
  items: SuggestedItem[];
};

type Draft = {
  id: string;
  label: string;
  reason: string;
  days: SuggestedDay[];
  notes?: string;
};

export function ItinerarySuggesterWorkspace({
  trips,
  isDemo,
}: {
  trips: TripOption[];
  isDemo: boolean;
}) {
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [destination, setDestination] = useState(
    trips[0]?.destination_name ?? "",
  );
  const [startDate, setStartDate] = useState(trips[0]?.start_date ?? "");
  const [endDate, setEndDate] = useState(trips[0]?.end_date ?? "");
  const [pace, setPace] = useState("balanced");
  const [mustDos, setMustDos] = useState("");
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

  async function generate() {
    setError(null);
    setMessage(null);
    if (!tripId) {
      setError("Select a trip first (suggestions use that trip’s destination)");
      return;
    }
    if (!destination.trim() && !selectedTrip?.destination_name) {
      setError("Set a destination on the trip before generating drafts");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Fall back to deterministic scaffolds (no invented fares/hotels)
        const fallback = buildDeterministicDrafts({
          destination:
            destination.trim() || selectedTrip?.destination_name || "Destination",
          startDate: startDate || selectedTrip?.start_date || undefined,
          endDate: endDate || selectedTrip?.end_date || undefined,
          mustDos: mustDoList(),
          pace,
        }) as Draft[];
        setDrafts(fallback);
        setSelectedDraftId(fallback[0]?.id ?? null);
        setMessage(
          data.error
            ? `AI unavailable (${data.error}). Showing deterministic scaffolds instead.`
            : "AI unavailable. Showing deterministic scaffolds instead.",
        );
        return;
      }
      const days = (data.days ?? []) as SuggestedDay[];
      const notes = data.notes as string | undefined;
      if (!days.length) {
        const fallback = buildDeterministicDrafts({
          destination:
            destination.trim() || selectedTrip?.destination_name || "Destination",
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          mustDos: mustDoList(),
          pace,
        }) as Draft[];
        setDrafts(fallback);
        setSelectedDraftId(fallback[0]?.id ?? null);
        setMessage("AI returned no days — using deterministic scaffolds.");
        return;
      }
      // Build up to 3 distinct draft lenses from the same verified AI output
      // (deterministic variants — not invented flights/hotels).
      const variants: Draft[] = [
        {
          id: "balanced",
          label: "Balanced draft",
          reason: "Uses the suggested pace and must-dos as returned by the model.",
          days,
          notes,
        },
      ];
      if (days.length > 1) {
        variants.push({
          id: "lighter",
          label: "Lighter days",
          reason: "Same places, fewer stops per day (first half of each day).",
          days: days.map((d) => ({
            ...d,
            items: d.items.slice(0, Math.max(1, Math.ceil(d.items.length / 2))),
          })),
          notes,
        });
        variants.push({
          id: "must-first",
          label: "Must-dos first",
          reason: "Prioritizes items whose category or title matches your must-dos.",
          days: days.map((d) => ({
            ...d,
            items: [...d.items].sort((a, b) => {
              const score = (item: SuggestedItem) =>
                mustDoList().some((m) =>
                  `${item.title} ${item.category}`.toLowerCase().includes(m.toLowerCase()),
                )
                  ? 0
                  : 1;
              return score(a) - score(b);
            }),
          })),
          notes,
        });
      }
      setDrafts(variants);
      setSelectedDraftId(variants[0]?.id ?? null);
    } catch (e) {
      const fallback = buildDeterministicDrafts({
        destination:
          destination.trim() || selectedTrip?.destination_name || "Destination",
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        mustDos: mustDoList(),
        pace,
      }) as Draft[];
      setDrafts(fallback);
      setSelectedDraftId(fallback[0]?.id ?? null);
      setMessage(
        `${(e as Error).message || "Could not reach AI"} — showing deterministic scaffolds.`,
      );
    } finally {
      setLoading(false);
    }
  }

  function mustDoList() {
    return mustDos
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function addDraftToTrip(draft: Draft, selectedOnly = false) {
    if (!tripId) {
      setError("Select a destination trip first");
      return;
    }
    const dedupeKey = `${tripId}:${draft.id}`;
    if (addedKeys.has(dedupeKey)) {
      setMessage("This draft was already added to the trip.");
      return;
    }

    const items = draft.days.flatMap((d) =>
      d.items.map((item) => ({ day: d.dayNumber, item })),
    );
    const toAdd = selectedOnly
      ? items.filter(({ item }) =>
          mustDoList().some((m) =>
            item.title.toLowerCase().includes(m.toLowerCase()),
          ),
        )
      : items;

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
        for (const { item } of toAdd) {
          await addItineraryItemAction({
            tripId,
            title: item.title,
            item_type: "place",
            location_name: item.locationName ?? item.title,
            details: {
              source: "itinerary_suggester",
              draftId: draft.id,
              category: item.category,
              description: item.description ?? null,
              suggested: true,
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
          Generate draft itineraries from your trip preferences. Drafts are not
          saved until you click Add to Itinerary.
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
          {selectedTrip ? (
            <p className="text-xs text-muted">
              Reusing trip fields where available.{" "}
              <Link className="text-brand underline" href={`/trips/${selectedTrip.id}`}>
                Open trip itinerary
              </Link>
            </p>
          ) : null}
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
          />
        </div>
        <Button disabled={loading} onClick={() => void generate()}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating…" : "Generate draft alternatives"}
        </Button>
      </section>

      {drafts.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            {drafts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDraftId(d.id)}
                className={`w-full rounded-[12px] border p-3 text-left ${
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
          {selectedDraft ? (
            <div className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{selectedDraft.label}</h2>
                  <p className="text-xs text-muted">{selectedDraft.reason}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending || !tripId}
                    onClick={() => addDraftToTrip(selectedDraft, false)}
                  >
                    Add to Itinerary
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={pending || !tripId}
                    onClick={() => addDraftToTrip(selectedDraft, true)}
                  >
                    Add must-dos only
                  </Button>
                </div>
              </div>
              {selectedDraft.notes ? (
                <p className="mt-3 text-sm text-muted">{selectedDraft.notes}</p>
              ) : null}
              <div className="mt-4 space-y-4">
                {selectedDraft.days.map((day) => (
                  <div key={day.dayNumber}>
                    <h3 className="text-sm font-semibold">
                      Day {day.dayNumber}
                      {day.title ? ` · ${day.title}` : ""}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {day.items.map((item) => (
                        <li
                          key={`${day.dayNumber}-${item.title}`}
                          className="rounded-[10px] border border-border px-3 py-2"
                        >
                          <p className="font-medium">{item.title}</p>
                          {item.description ? (
                            <p className="text-xs text-muted">{item.description}</p>
                          ) : null}
                          <p className="text-[11px] capitalize text-brand">
                            {item.category}
                            {item.locationName ? ` · ${item.locationName}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted">
          Draft alternatives will appear here. Nothing is written to a trip until
          you confirm Add to Itinerary.
        </div>
      )}
    </div>
  );
}
