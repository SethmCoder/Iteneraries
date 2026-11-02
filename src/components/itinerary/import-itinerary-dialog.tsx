"use client";

import { useMemo, useState } from "react";
import { FileInput, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_TRIP_ID } from "@/lib/demo-config";
import {
  buildOptimizedArrangement,
  combineDateTime,
  endAtFromStart,
  flattenArrangement,
  importFingerprint,
  isDuplicateAgainstExisting,
  parseItineraryTextHeuristic,
  type ImportArrangement,
  type ImportDraftItem,
  type ImportItemType,
} from "@/lib/itinerary/import-schedule";
import type { ItineraryItem, Trip } from "@/types/database";
import { cn } from "@/lib/utils";

type PreviewPayload = {
  original: ImportArrangement;
  optimized: ImportArrangement;
  warnings: string[];
  changes: string[];
  flags: string[];
  notes?: string;
};

type ArrangementKey = "original" | "optimized";

export type ImportConfirmItem = {
  title: string;
  description: string | null;
  location_name: string | null;
  item_type: ImportItemType;
  start_at: string | null;
  end_at: string | null;
  timezone: string | null;
  details: Record<string, unknown>;
};

export function ImportItineraryDialog({
  trip,
  existingItems,
  open,
  onOpenChange,
  onConfirm,
}: {
  trip: Trip;
  existingItems: ItineraryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (items: ImportConfirmItem[]) => Promise<{
    added: number;
    skipped: number;
  }>;
}) {
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [arrangementKey, setArrangementKey] =
    useState<ArrangementKey>("original");
  const [draftDays, setDraftDays] = useState<ImportArrangement["days"]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  function reset() {
    setStep("paste");
    setText("");
    setGenerating(false);
    setImporting(false);
    setError(null);
    setPreview(null);
    setArrangementKey("original");
    setDraftDays([]);
    setResultMsg(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function generate() {
    const trimmed = text.trim();
    if (trimmed.length < 8) {
      setError("Paste a longer itinerary before generating.");
      return;
    }
    setGenerating(true);
    setError(null);
    setResultMsg(null);
    try {
      let payload: PreviewPayload;

      if (trip.id === DEMO_TRIP_ID) {
        const original = parseItineraryTextHeuristic(
          trimmed,
          trip.start_date,
          trip.end_date,
        );
        const optimized = buildOptimizedArrangement(
          original,
          trip.start_date,
          trip.end_date,
        );
        payload = {
          original,
          optimized: optimized.arrangement,
          warnings: [
            "Demo mode: parsed locally without calling the AI API.",
          ],
          changes: optimized.changes,
          flags: [],
          notes: "Preview from heuristic parse (demo trip).",
        };
      } else {
        const res = await fetch("/api/ai/import-itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId: trip.id, text: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to parse itinerary");
        }
        payload = data as PreviewPayload;
      }

      setPreview(payload);
      setArrangementKey("original");
      setDraftDays(structuredClone(payload.original.days));
      setStep("preview");
    } catch (e) {
      setError((e as Error).message || "Failed to parse itinerary");
    } finally {
      setGenerating(false);
    }
  }

  function selectArrangement(key: ArrangementKey) {
    if (!preview) return;
    setArrangementKey(key);
    setDraftDays(
      structuredClone(
        key === "original" ? preview.original.days : preview.optimized.days,
      ),
    );
  }

  function updateItem(
    dayIndex: number,
    itemIndex: number,
    patch: Partial<ImportDraftItem>,
  ) {
    setDraftDays((prev) =>
      prev.map((day, di) =>
        di !== dayIndex
          ? day
          : {
              ...day,
              items: day.items.map((item, ii) =>
                ii !== itemIndex ? item : { ...item, ...patch },
              ),
            },
      ),
    );
  }

  function removeItem(dayIndex: number, itemIndex: number) {
    setDraftDays((prev) =>
      prev
        .map((day, di) =>
          di !== dayIndex
            ? day
            : { ...day, items: day.items.filter((_, ii) => ii !== itemIndex) },
        )
        .filter((d) => d.items.length > 0),
    );
  }

  const flatCount = useMemo(
    () => draftDays.reduce((n, d) => n + d.items.length, 0),
    [draftDays],
  );

  async function confirmImport() {
    if (flatCount === 0) {
      setError("Nothing to import — add or keep at least one activity.");
      return;
    }
    setImporting(true);
    setError(null);
    setResultMsg(null);
    try {
      const arrangement: ImportArrangement = { days: draftDays };
      const flat = flattenArrangement(arrangement);
      const existingSummary = existingItems.map((i) => ({
        title: i.title,
        start_at: i.start_at,
        details: (i.details ?? {}) as Record<string, unknown>,
      }));

      const toAdd: ImportConfirmItem[] = [];
      let skipped = 0;
      for (const draft of flat) {
        if (isDuplicateAgainstExisting(draft, existingSummary)) {
          skipped += 1;
          continue;
        }
        const date = draft.date;
        const start_at = combineDateTime(
          trip.start_date,
          draft.dayNumber ?? 1,
          draft.startTime,
          date,
        );
        const duration = draft.durationMinutes ?? 90;
        const end_at =
          draft.endTime
            ? combineDateTime(
                trip.start_date,
                draft.dayNumber ?? 1,
                draft.endTime,
                date,
              )
            : endAtFromStart(start_at, duration);
        const fp = importFingerprint({
          title: draft.title,
          date: date ?? start_at?.slice(0, 10),
          startTime: draft.startTime,
        });
        toAdd.push({
          title: draft.title,
          description: draft.description ?? draft.notes ?? null,
          location_name: draft.locationName ?? draft.title,
          item_type: draft.itemType ?? "place",
          start_at,
          end_at,
          timezone: trip.timezone,
          details: {
            source: "ai_itinerary_import",
            importFingerprint: fp,
            suggestedDay: draft.dayNumber,
            startTime: draft.startTime,
            durationMinutes: duration,
          },
        });
        existingSummary.push({
          title: draft.title,
          start_at,
          details: { source: "ai_itinerary_import", importFingerprint: fp },
        });
      }

      const result = await onConfirm(toAdd);
      const totalSkipped = skipped + result.skipped;
      setResultMsg(
        `Imported ${result.added} item${result.added === 1 ? "" : "s"}${
          totalSkipped
            ? ` · skipped ${totalSkipped} duplicate${totalSkipped === 1 ? "" : "s"}`
            : ""
        }.`,
      );
      if (result.added > 0) {
        // Brief pause so the user sees the message, then close.
        window.setTimeout(() => handleOpenChange(false), 900);
      }
    } catch (e) {
      setError((e as Error).message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Itinerary</DialogTitle>
          <DialogDescription>
            Paste an itinerary you already wrote. AI will structure it for this
            trip — review and edit before anything is added.
          </DialogDescription>
        </DialogHeader>

        {step === "paste" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-paste">Itinerary text</Label>
              <textarea
                id="import-paste"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Day 1\n9:00 AM – Breakfast at Café de Flore\n11:00 AM – Visit the Eiffel Tower\n\nDay 2\n10:30 AM – Visit Notre-Dame`}
                rows={12}
                className="flex w-full min-w-0 rounded-[8px] border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void generate()}
                disabled={generating || text.trim().length < 8}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Generating…" : "Generate Itinerary"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {preview?.notes ? (
              <p className="text-sm text-muted">{preview.notes}</p>
            ) : null}

            {(preview?.warnings.length ||
              preview?.flags.length ||
              preview?.changes.length) ? (
              <div className="space-y-2 rounded-[10px] border border-border bg-brand-light/40 p-3 text-sm">
                {preview?.flags.map((f) => (
                  <p key={f} className="text-warning">
                    {f}
                  </p>
                ))}
                {preview?.warnings.slice(0, 8).map((w) => (
                  <p key={w} className="text-muted">
                    {w}
                  </p>
                ))}
                {preview && preview.warnings.length > 8 ? (
                  <p className="text-xs text-muted">
                    +{preview.warnings.length - 8} more notes
                  </p>
                ) : null}
                {preview?.changes.slice(0, 6).map((c) => (
                  <p key={c} className="text-foreground">
                    {c}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={arrangementKey === "original" ? "default" : "secondary"}
                onClick={() => selectArrangement("original")}
              >
                Original arrangement
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  arrangementKey === "optimized" ? "default" : "secondary"
                }
                onClick={() => selectArrangement("optimized")}
              >
                AI-suggested arrangement
              </Button>
            </div>

            <div className="max-h-[min(50vh,24rem)] space-y-4 overflow-y-auto pr-1">
              {draftDays.map((day, dayIndex) => (
                <div
                  key={`day-${day.dayNumber}-${dayIndex}`}
                  className="rounded-[10px] border border-border p-3"
                >
                  <h3 className="mb-2 text-sm font-semibold">
                    Day {day.dayNumber}
                    {day.date ? (
                      <span className="ml-2 font-normal text-muted">
                        {day.date}
                      </span>
                    ) : null}
                  </h3>
                  <div className="space-y-3">
                    {day.items.map((item, itemIndex) => (
                      <div
                        key={`${item.title}-${itemIndex}`}
                        className="space-y-2 rounded-[8px] border border-border bg-white p-2"
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Title</Label>
                            <Input
                              value={item.title}
                              onChange={(e) =>
                                updateItem(dayIndex, itemIndex, {
                                  title: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input
                              type="date"
                              value={item.date ?? day.date ?? ""}
                              onChange={(e) =>
                                updateItem(dayIndex, itemIndex, {
                                  date: e.target.value || undefined,
                                })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Start</Label>
                              <Input
                                value={item.startTime ?? ""}
                                placeholder="09:00"
                                onChange={(e) =>
                                  updateItem(dayIndex, itemIndex, {
                                    startTime: e.target.value || undefined,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End</Label>
                              <Input
                                value={item.endTime ?? ""}
                                placeholder="10:30"
                                onChange={(e) =>
                                  updateItem(dayIndex, itemIndex, {
                                    endTime: e.target.value || undefined,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Location</Label>
                            <Input
                              value={item.locationName ?? ""}
                              onChange={(e) =>
                                updateItem(dayIndex, itemIndex, {
                                  locationName: e.target.value || undefined,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateItem(dayIndex, itemIndex, {
                                  description: e.target.value || undefined,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removeItem(dayIndex, itemIndex)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {flatCount === 0 ? (
                <p className="text-sm text-muted">No activities in preview.</p>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            {resultMsg ? (
              <p className={cn("text-sm text-success")}>{resultMsg}</p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep("paste");
                  setError(null);
                  setResultMsg(null);
                }}
                disabled={importing}
              >
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleOpenChange(false)}
                  disabled={importing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void confirmImport()}
                  disabled={importing || flatCount === 0}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileInput className="h-4 w-4" />
                  )}
                  {importing ? "Importing…" : "Confirm import"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
