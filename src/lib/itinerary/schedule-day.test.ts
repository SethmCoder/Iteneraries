import { describe, expect, it } from "vitest";
import { scheduleTripDays } from "@/lib/itinerary/schedule-day";
import type { ResolvedPlace } from "@/lib/places/resolve";

const eiffel: ResolvedPlace = {
  name: "Eiffel Tower",
  address: "Champ de Mars, Paris",
  lat: 48.8584,
  lon: 2.2945,
  osmType: "way",
  osmId: "1",
  category: "attraction",
  openingHoursRaw: "09:00-23:00",
  hoursStatus: "verified",
  estimatedDurationMinutes: 90,
  durationIsEstimate: true,
  sourceQuery: "Eiffel Tower",
};

describe("scheduleTripDays", () => {
  it("schedules must-dos with start times and excludes overload", () => {
    const { days, excluded } = scheduleTripDays({
      destination: "Paris",
      startDate: "2026-10-15",
      endDate: "2026-10-16",
      pace: "relaxed",
      mustDos: [{ ...eiffel, required: true }],
      saved: [],
    });
    expect(days.length).toBe(2);
    const titles = days.flatMap((d) => d.items.map((i) => i.title));
    expect(titles).toContain("Eiffel Tower");
    expect(days[0]!.items.some((i) => i.startTime)).toBe(true);
    expect(
      days.some((d) => d.items.some((i) => i.source === "unscheduled")),
    ).toBe(true);
    void excluded;
  });

  it("does not pad with Free time / buffer titles", () => {
    const { days } = scheduleTripDays({
      destination: "Paris",
      startDate: "2026-10-15",
      endDate: "2026-10-17",
      mustDos: [{ ...eiffel, required: true }],
      saved: [],
    });
    const titles = days.flatMap((d) => d.items.map((i) => i.title));
    expect(titles.some((t) => /free time \/ buffer/i.test(t))).toBe(false);
  });
});
