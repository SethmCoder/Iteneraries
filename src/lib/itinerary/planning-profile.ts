import { z } from "zod";

export const constraintKindSchema = z.enum(["fixed", "flexible", "preferred"]);

export const planningScenarioSchema = z.enum([
  "destination_and_dates",
  "destination_flexible_dates",
  "dates_flexible_destination",
  "both_flexible",
  "fixed_event",
]);

export const guidedPhaseSchema = z.enum([
  "flights",
  "major_activities",
  "hotels",
  "lesser_activities",
  "done",
]);

export const planningProfileSchema = z.object({
  scenario: planningScenarioSchema.optional(),
  originAirports: z.array(z.string().trim().min(3).max(3)).max(8).optional(),
  destinations: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  dateFlexibility: constraintKindSchema.optional(),
  destinationFlexibility: constraintKindSchema.optional(),
  travelers: z.number().int().min(1).max(20).optional(),
  budgetNote: z.string().max(500).optional(),
  purpose: z.string().max(200).optional(),
  mustDos: z.array(z.string().max(200)).max(20).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  cashVsPoints: z.enum(["cash", "points", "either"]).optional(),
  fixedEvent: z
    .object({
      title: z.string().max(200),
      date: z.string().optional(),
      location: z.string().max(200).optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
  guidedPhase: guidedPhaseSchema.optional(),
  skippedPhases: z.array(guidedPhaseSchema).max(8).optional(),
});

export type PlanningProfile = z.infer<typeof planningProfileSchema>;
export type PlanningScenario = z.infer<typeof planningScenarioSchema>;
export type GuidedPhase = z.infer<typeof guidedPhaseSchema>;

export type StageStatus =
  | "not_started"
  | "in_progress"
  | "selected"
  | "confirmed"
  | "skipped";

export type PlanningStageId =
  | "flights"
  | "major_activities"
  | "hotels"
  | "lesser_activities";

export const PLANNING_STAGES: {
  id: PlanningStageId;
  label: string;
  short: string;
}[] = [
  { id: "flights", label: "Flights", short: "Flights" },
  { id: "major_activities", label: "Major activities", short: "Activities" },
  { id: "hotels", label: "Hotels", short: "Hotels" },
  { id: "lesser_activities", label: "Lesser activities", short: "Itinerary" },
];

type BookingLike = { booking_status: string };
type ItemLike = {
  title: string;
  details?: Record<string, unknown> | null;
  start_at?: string | null;
};

export function parsePlanningProfile(
  raw: unknown,
): PlanningProfile {
  const parsed = planningProfileSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function deriveStageStatuses(input: {
  profile: PlanningProfile;
  flights: BookingLike[];
  hotels: BookingLike[];
  activities?: BookingLike[];
  items: ItemLike[];
}): Record<PlanningStageId, StageStatus> {
  const skipped = new Set(input.profile.skippedPhases ?? []);

  const flightStatus = (): StageStatus => {
    if (skipped.has("flights")) return "skipped";
    if (input.flights.some((f) => f.booking_status === "booked")) {
      return "confirmed";
    }
    if (input.flights.some((f) => f.booking_status === "skipped")) {
      return "skipped";
    }
    if (
      input.flights.some(
        (f) =>
          f.booking_status === "needs_booking" ||
          f.booking_status === "in_progress",
      )
    ) {
      return "in_progress";
    }
    if (input.flights.length > 0) return "selected";
    return "not_started";
  };

  const mustDos = (input.profile.mustDos ?? []).map((m) => m.toLowerCase());
  const majorOnItinerary = input.items.filter((item) => {
    const d = item.details ?? {};
    if (d.priority === "major" || d.category === "must_do") return true;
    if (mustDos.some((m) => item.title.toLowerCase().includes(m))) return true;
    return false;
  });

  const majorStatus = (): StageStatus => {
    if (skipped.has("major_activities")) return "skipped";
    if (
      majorOnItinerary.length > 0 ||
      (input.activities ?? []).some((a) => a.booking_status === "booked")
    ) {
      return "confirmed";
    }
    if (
      mustDos.length > 0 ||
      (input.activities ?? []).some(
        (a) =>
          a.booking_status === "needs_booking" ||
          a.booking_status === "in_progress",
      )
    ) {
      return "in_progress";
    }
    return "not_started";
  };

  const hotelStatus = (): StageStatus => {
    if (skipped.has("hotels")) return "skipped";
    if (input.hotels.some((h) => h.booking_status === "booked")) {
      return "confirmed";
    }
    if (input.hotels.some((h) => h.booking_status === "skipped")) {
      return "skipped";
    }
    if (
      input.hotels.some(
        (h) =>
          h.booking_status === "needs_booking" ||
          h.booking_status === "in_progress",
      )
    ) {
      return "in_progress";
    }
    if (input.hotels.length > 0) return "selected";
    return "not_started";
  };

  const lesserStatus = (): StageStatus => {
    if (skipped.has("lesser_activities")) return "skipped";
    if (input.profile.guidedPhase === "done") return "confirmed";
    const lesser = input.items.filter((item) => {
      const d = item.details ?? {};
      if (d.priority === "major" || d.category === "must_do") return false;
      return item.start_at != null || d.suggested === true;
    });
    if (lesser.length >= 3) return "confirmed";
    if (lesser.length > 0) return "in_progress";
    const priorOk =
      ["confirmed", "skipped", "selected"].includes(flightStatus()) ||
      ["confirmed", "skipped"].includes(majorStatus());
    if (!priorOk && majorStatus() === "not_started") return "not_started";
    return lesser.length ? "in_progress" : "not_started";
  };

  return {
    flights: flightStatus(),
    major_activities: majorStatus(),
    hotels: hotelStatus(),
    lesser_activities: lesserStatus(),
  };
}

export function nextIncompleteStage(
  statuses: Record<PlanningStageId, StageStatus>,
  profile: PlanningProfile,
): PlanningStageId | "done" {
  if (profile.guidedPhase === "done") return "done";
  for (const stage of PLANNING_STAGES) {
    const s = statuses[stage.id];
    if (s === "not_started" || s === "in_progress" || s === "selected") {
      return stage.id;
    }
  }
  return "done";
}

export function initialGuidedPhase(
  scenario?: PlanningScenario,
): GuidedPhase {
  if (scenario === "fixed_event") return "major_activities";
  if (
    scenario === "dates_flexible_destination" ||
    scenario === "both_flexible"
  ) {
    return "major_activities";
  }
  return "flights";
}

export function stageStatusLabel(status: StageStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "selected":
      return "Selected";
    case "confirmed":
      return "Confirmed";
    case "skipped":
      return "Skipped";
  }
}
