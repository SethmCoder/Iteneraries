import { z } from "zod";
import { chatJson } from "@/lib/ai/client";
import {
  buildOptimizedArrangement,
  distributeAcrossDays,
  fillTimesAndDetectIssues,
  mapDaysOntoTrip,
  type ImportArrangement,
  type ImportDraftItem,
  type ImportItemType,
} from "@/lib/itinerary/import-schedule";

const optionalString = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const hhmm = z
  .string()
  .nullish()
  .transform((v) => {
    if (!v || !v.trim()) return undefined;
    const t = v.trim();
    if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) {
      const [h, m] = t.split(":");
      return `${h!.padStart(2, "0")}:${m}`;
    }
    return t;
  });

const itemTypeSchema = z
  .enum([
    "place",
    "flight",
    "hotel",
    "train",
    "ground_transport",
    "other",
  ])
  .nullish()
  .transform((v) => v ?? ("place" as const));

export const importDraftItemSchema = z.object({
  title: z.string().min(1).max(300),
  description: optionalString,
  locationName: optionalString,
  startTime: hhmm,
  endTime: hhmm,
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .nullish()
    .transform((v) => v ?? undefined),
  itemType: itemTypeSchema,
  notes: optionalString,
  dayNumber: z.number().int().positive().max(31).nullish().transform((v) => v ?? undefined),
  date: z
    .string()
    .nullish()
    .transform((v) =>
      v && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : undefined,
    ),
});

export const importDraftDaySchema = z.object({
  dayNumber: z.number().int().positive().max(31),
  date: z
    .string()
    .nullish()
    .transform((v) =>
      v && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : undefined,
    ),
  title: optionalString,
  items: z.array(importDraftItemSchema).max(40),
});

/** Raw AI JSON shape before schedule post-processing. */
export const importItineraryAiSchema = z.object({
  days: z.array(importDraftDaySchema).max(31).optional(),
  items: z.array(importDraftItemSchema).max(80).optional(),
  notes: optionalString,
  warnings: z.array(z.string()).nullish().transform((v) => v ?? []),
  changes: z.array(z.string()).nullish().transform((v) => v ?? []),
  flags: z.array(z.string()).nullish().transform((v) => v ?? []),
});

export type ImportItineraryAiResult = z.infer<typeof importItineraryAiSchema>;

export type ImportItineraryResult = {
  original: ImportArrangement;
  optimized: ImportArrangement;
  warnings: string[];
  changes: string[];
  flags: string[];
  notes?: string;
  source: "ai";
};

export type ImportItineraryContext = {
  pastedText: string;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string | null;
  destination?: string | null;
  tripName?: string | null;
  existingItems?: Array<{ title: string; start_at: string | null }>;
};

const SYSTEM_PROMPT = `You are an itinerary parser for a travel app called Waypoint.
The user pastes a loosely formatted itinerary (Day N, bullets, paragraphs, numbered lists, time schedules, etc.).
Extract structured activities. Do NOT invent booking confirmations, prices, or fake places.
Do NOT require a strict format — interpret reasonable free text.

Return a single JSON object with:
- days: array of { dayNumber, date (YYYY-MM-DD if known), title?, items: [...] }
  OR items: a flat array if no day structure is present
- Each item: { title, description?, locationName?, startTime (HH:mm 24h if known), endTime?, durationMinutes?, itemType (place|flight|hotel|train|ground_transport|other), notes?, dayNumber?, date? }
- warnings: strings about ambiguity or missing info
- changes: empty array (server will add schedule suggestions)
- flags: strings like overlap / crowded / missing destination / out of range hints
- notes: optional short summary

Rules:
- Preserve the user's activity order within each day.
- Prefer the user's stated times; leave startTime empty if unknown (do not invent exact clock times unless clearly implied).
- Map meals/sightseeing/transport to a sensible itemType (default place).
- If Day 1 / Day 2 labels exist, use dayNumber accordingly.
- If calendar dates appear, include date as YYYY-MM-DD.
- Never drop activities because a day looks busy — note crowding in flags instead.`;

export function buildImportUserPrompt(ctx: ImportItineraryContext): string {
  const existing =
    ctx.existingItems
      ?.slice(0, 40)
      .map((i) => `- ${i.title}${i.start_at ? ` @ ${i.start_at}` : ""}`)
      .join("\n") || "(none)";

  return [
    `Trip: ${ctx.tripName || "Untitled"}`,
    `Destination: ${ctx.destination || "unknown"}`,
    `Start date: ${ctx.startDate || "unknown"}`,
    `End date: ${ctx.endDate || "unknown"}`,
    `Timezone: ${ctx.timezone || "unknown"}`,
    "",
    "Existing itinerary items (for awareness; do not duplicate unless the paste clearly repeats them):",
    existing,
    "",
    "Pasted itinerary text:",
    "---",
    ctx.pastedText.slice(0, 20_000),
    "---",
  ].join("\n");
}

export function parseImportAiPayload(raw: unknown): ImportItineraryAiResult {
  const parsed = importItineraryAiSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("AI returned an invalid itinerary import payload.");
  }
  return parsed.data;
}

function arrangementFromAi(
  ai: ImportItineraryAiResult,
  startDate?: string | null,
  endDate?: string | null,
): ImportArrangement {
  if (ai.days && ai.days.length > 0) {
    return {
      days: ai.days.map((d) => ({
        dayNumber: d.dayNumber,
        date: d.date,
        title: d.title,
        items: d.items.map(toDraftItem),
      })),
    };
  }
  const flat = (ai.items ?? []).map(toDraftItem);
  return distributeAcrossDays(flat, startDate, endDate);
}

function toDraftItem(
  item: z.infer<typeof importDraftItemSchema>,
): ImportDraftItem {
  return {
    title: item.title,
    description: item.description,
    locationName: item.locationName,
    startTime: item.startTime,
    endTime: item.endTime,
    durationMinutes: item.durationMinutes,
    itemType: item.itemType as ImportItemType,
    notes: item.notes,
    dayNumber: item.dayNumber,
    date: item.date,
  };
}

/** Post-process AI output into original + optimized arrangements with warnings. */
export function finalizeImportArrangements(
  ai: ImportItineraryAiResult,
  startDate?: string | null,
  endDate?: string | null,
): ImportItineraryResult {
  const base = arrangementFromAi(ai, startDate, endDate);
  const mapped = mapDaysOntoTrip(base, startDate, endDate);
  const filled = fillTimesAndDetectIssues(mapped.arrangement);
  const optimized = buildOptimizedArrangement(
    filled.arrangement,
    startDate,
    endDate,
  );

  return {
    original: filled.arrangement,
    optimized: optimized.arrangement,
    warnings: [
      ...ai.warnings,
      ...mapped.warnings,
      ...filled.warnings,
    ],
    changes: [...ai.changes, ...optimized.changes],
    flags: [...ai.flags, ...filled.flags],
    notes: ai.notes,
    source: "ai",
  };
}

export async function importItineraryFromText(
  ctx: ImportItineraryContext,
  signal?: AbortSignal,
): Promise<ImportItineraryResult> {
  const text = ctx.pastedText.trim();
  if (text.length < 8) {
    throw new Error("Paste a longer itinerary before generating.");
  }

  const aiRaw = await chatJson({
    system: SYSTEM_PROMPT,
    user: buildImportUserPrompt(ctx),
    schema: importItineraryAiSchema,
    temperature: 0.2,
    signal,
  });

  return finalizeImportArrangements(aiRaw, ctx.startDate, ctx.endDate);
}
