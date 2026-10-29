import { describe, expect, it } from "vitest";
import {
  deriveStageStatuses,
  initialGuidedPhase,
  nextIncompleteStage,
} from "@/lib/itinerary/planning-profile";

describe("planning workflow helpers", () => {
  it("starts fixed-event trips on major activities", () => {
    expect(initialGuidedPhase("fixed_event")).toBe("major_activities");
    expect(initialGuidedPhase("destination_and_dates")).toBe("flights");
  });

  it("marks flights confirmed when booked", () => {
    const statuses = deriveStageStatuses({
      profile: {},
      flights: [{ booking_status: "booked" }],
      hotels: [],
      items: [],
    });
    expect(statuses.flights).toBe("confirmed");
    expect(nextIncompleteStage(statuses, {})).toBe("major_activities");
  });

  it("respects skipped phases", () => {
    const statuses = deriveStageStatuses({
      profile: { skippedPhases: ["flights", "hotels"] },
      flights: [],
      hotels: [],
      items: [],
    });
    expect(statuses.flights).toBe("skipped");
    expect(statuses.hotels).toBe("skipped");
  });
});
