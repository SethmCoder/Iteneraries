import { z } from "zod";
import { chatJson } from "@/lib/ai/client";

const optionalString = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const optionalNumber = z
  .number()
  .nullish()
  .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined));

export const SUGGESTION_CATEGORIES = [
  "attraction",
  "museum",
  "restaurant",
  "cafe",
  "park",
  "historic",
  "shopping",
  "activity",
  "other",
] as const;

export const suggestionItemSchema = z.object({
  title: z.string().min(1),
  description: optionalString,
  category: z
    .string()
    .transform((v) => v.toLowerCase().trim())
    .pipe(
      z.string().transform((v) =>
        (SUGGESTION_CATEGORIES as readonly string[]).includes(v)
          ? (v as (typeof SUGGESTION_CATEGORIES)[number])
          : ("other" as const),
      ),
    ),
  /** A real place name or address that can be geocoded. No coordinates are accepted from the model. */
  locationName: optionalString,
  /** 24h local time "HH:mm". */
  startTime: z
    .string()
    .nullish()
    .transform((v) => (v && /^\d{2}:\d{2}$/.test(v.trim()) ? v.trim() : undefined)),
  durationMinutes: optionalNumber,
});

export const suggestItinerarySchema = z.object({
  days: z
    .array(
      z.object({
        dayNumber: z.number().int().min(1),
        title: optionalString,
        items: z.array(suggestionItemSchema),
      }),
    )
    .min(1),
  notes: optionalString,
});

export type SuggestedItem = z.output<typeof suggestionItemSchema>;
export type SuggestedItinerary = z.output<typeof suggestItinerarySchema>;

export type SuggestPromptInput = {
  destination: string;
  startDate?: string;
  endDate?: string;
  /** Number of days; derived from dates when omitted. */
  days?: number;
  interests?: string[];
  pace?: "relaxed" | "moderate" | "packed";
  budget?: string;
  travelers?: number;
  existingStops?: string[];
  notes?: string;
  /** Items already on the trip (do not repeat). */
  existingItems?: Array<{ title: string; start_at?: string | null }>;
  /** The traveler's other trips, for context only. */
  otherTrips?: Array<{ destination_name?: string | null; status?: string | null }>;
  preferences?: {
    travel_pace?: string | null;
    interests?: string[] | null;
    preferred_transport_modes?: string[] | null;
  };
};

function daysBetween(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return undefined;
  return Math.round((e - s) / 86_400_000) + 1;
}

export function buildSuggestPrompt(input: SuggestPromptInput): {
  system: string;
  user: string;
} {
  const dayCount = Math.max(
    1,
    Math.min(21, input.days ?? daysBetween(input.startDate, input.endDate) ?? 3),
  );

  const system = [
    "You are a travel planner that suggests day-by-day itineraries.",
    "Only suggest real, well-known places that actually exist in the destination.",
    "Never invent places, addresses, opening hours, prices, or coordinates. If unsure about a detail, omit it (use null).",
    "Give each item a locationName that can be looked up on a map (place name plus city).",
    "Group nearby places on the same day and keep realistic travel times.",
    `Allowed categories: ${SUGGESTION_CATEGORIES.join(", ")}.`,
    "Output JSON shaped as:",
    '{"days":[{"dayNumber":1,"title":string|null,"items":[{"title":string,"description":string|null,"category":string,"locationName":string|null,"startTime":"HH:mm"|null,"durationMinutes":number|null}]}],"notes":string|null}',
  ].join("\n");

  const lines = [
    `Destination: ${input.destination}`,
    `Number of days: ${dayCount}`,
  ];
  if (input.startDate) lines.push(`Start date: ${input.startDate}`);
  if (input.endDate) lines.push(`End date: ${input.endDate}`);
  if (input.travelers) lines.push(`Travelers: ${input.travelers}`);
  if (input.pace) lines.push(`Pace: ${input.pace}`);
  if (input.budget) lines.push(`Budget: ${input.budget}`);
  if (input.interests?.length) lines.push(`Interests: ${input.interests.join(", ")}`);
  const existing = [
    ...(input.existingStops ?? []),
    ...(input.existingItems ?? []).map((i) => i.title),
  ].filter(Boolean);
  if (existing.length) {
    lines.push(`Already planned (do not repeat): ${existing.join("; ")}`);
  }
  const prefs = input.preferences;
  if (prefs?.travel_pace) lines.push(`Preferred pace: ${prefs.travel_pace}`);
  if (prefs?.interests?.length) {
    lines.push(`Saved interests: ${prefs.interests.join(", ")}`);
  }
  if (prefs?.preferred_transport_modes?.length) {
    lines.push(`Preferred transport: ${prefs.preferred_transport_modes.join(", ")}`);
  }
  const past = (input.otherTrips ?? [])
    .map((t) => t.destination_name)
    .filter((d): d is string => Boolean(d));
  if (past.length) lines.push(`Other trips (context only): ${past.join("; ")}`);
  if (input.notes) lines.push(`Additional notes: ${input.notes}`);
  lines.push(`Return exactly ${dayCount} day(s).`);

  return { system, user: lines.join("\n") };
}

/** Parse and validate model output (a JSON string or already-parsed value). */
export function parseSuggestions(raw: unknown): SuggestedItinerary {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    } catch {
      throw new Error("Itinerary suggestions were not valid JSON.");
    }
  }
  const result = suggestItinerarySchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Itinerary suggestions were invalid: ${issues}`);
  }
  return result.data;
}

/** Build the prompt, call the AI provider, and return validated suggestions. */
export async function suggestItinerary(
  input: SuggestPromptInput,
  options: { signal?: AbortSignal } = {},
): Promise<SuggestedItinerary> {
  const { system, user } = buildSuggestPrompt(input);
  return chatJson({
    system,
    user,
    schema: suggestItinerarySchema,
    temperature: 0.4,
    signal: options.signal,
  });
}
