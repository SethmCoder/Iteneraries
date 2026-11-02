import { describe, expect, it } from "vitest";
import {
  finalizeImportArrangements,
  importItineraryAiSchema,
  parseImportAiPayload,
} from "@/lib/ai/import-itinerary";
import {
  buildOptimizedArrangement,
  combineDateTime,
  dayNumberToDate,
  distributeAcrossDays,
  fillTimesAndDetectIssues,
  importFingerprint,
  isDuplicateAgainstExisting,
  mapDaysOntoTrip,
  parseItineraryTextHeuristic,
  tripDayCount,
} from "@/lib/itinerary/import-schedule";

describe("import itinerary AI schema", () => {
  it("accepts day-structured payloads", () => {
    const parsed = parseImportAiPayload({
      days: [
        {
          dayNumber: 1,
          items: [
            {
              title: "Breakfast at Café de Flore",
              startTime: "09:00",
              locationName: "Café de Flore",
              itemType: "place",
            },
          ],
        },
      ],
      warnings: [],
      changes: [],
      flags: [],
    });
    expect(parsed.days?.[0]?.items[0]?.title).toContain("Café de Flore");
  });

  it("accepts flat item lists", () => {
    const result = importItineraryAiSchema.safeParse({
      items: [{ title: "Visit the Louvre", startTime: "15:00" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty titles", () => {
    const result = importItineraryAiSchema.safeParse({
      days: [{ dayNumber: 1, items: [{ title: "" }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("import schedule helpers", () => {
  it("maps Day N onto trip start date", () => {
    expect(tripDayCount("2026-06-01", "2026-06-03")).toBe(3);
    expect(dayNumberToDate("2026-06-01", 1)).toBe("2026-06-01");
    expect(dayNumberToDate("2026-06-01", 3)).toBe("2026-06-03");
  });

  it("clamps days beyond trip length with warnings", () => {
    const { arrangement, warnings } = mapDaysOntoTrip(
      {
        days: [
          {
            dayNumber: 5,
            items: [{ title: "Too far", startTime: "10:00" }],
          },
        ],
      },
      "2026-06-01",
      "2026-06-03",
    );
    expect(arrangement.days[0]?.dayNumber).toBe(3);
    expect(arrangement.days[0]?.date).toBe("2026-06-03");
    expect(warnings.some((w) => /exceeds/i.test(w))).toBe(true);
  });

  it("distributes undated items across trip days", () => {
    const items = [
      { title: "A" },
      { title: "B" },
      { title: "C" },
      { title: "D" },
    ];
    const arr = distributeAcrossDays(items, "2026-06-01", "2026-06-02");
    expect(arr.days).toHaveLength(2);
    expect(arr.days.flatMap((d) => d.items).map((i) => i.title)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("fills missing times without dropping activities", () => {
    const { arrangement, warnings } = fillTimesAndDetectIssues({
      days: [
        {
          dayNumber: 1,
          date: "2026-06-01",
          items: [
            { title: "Breakfast" },
            { title: "Museum", startTime: "11:00" },
            { title: "Lunch" },
          ],
        },
      ],
    });
    expect(arrangement.days[0]?.items).toHaveLength(3);
    expect(arrangement.days[0]?.items[0]?.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("flags crowded days and suggests moves in optimized arrangement", () => {
    const crowded = {
      days: [
        {
          dayNumber: 1,
          date: "2026-06-01",
          items: [
            { title: "One", startTime: "08:00", durationMinutes: 180 },
            { title: "Two", startTime: "11:00", durationMinutes: 180 },
            { title: "Three", startTime: "14:00", durationMinutes: 180 },
            { title: "Four", startTime: "17:00", durationMinutes: 180 },
          ],
        },
      ],
    };
    const filled = fillTimesAndDetectIssues(crowded);
    expect(filled.flags.some((f) => /crowded/i.test(f))).toBe(true);

    const optimized = buildOptimizedArrangement(
      crowded,
      "2026-06-01",
      "2026-06-03",
    );
    expect(optimized.arrangement.days.length).toBeGreaterThan(1);
    expect(optimized.changes.length).toBeGreaterThan(0);
    const total = optimized.arrangement.days.reduce(
      (n, d) => n + d.items.length,
      0,
    );
    expect(total).toBe(4);
  });

  it("builds stable fingerprints and detects duplicates", () => {
    const a = importFingerprint({
      title: "  Eiffel Tower ",
      date: "2026-06-01",
      startTime: "11:00",
    });
    const b = importFingerprint({
      title: "eiffel tower",
      date: "2026-06-01",
      startTime: "11:00",
    });
    expect(a).toBe(b);

    expect(
      isDuplicateAgainstExisting(
        { title: "Eiffel Tower", date: "2026-06-01", startTime: "11:00" },
        [
          {
            title: "Eiffel Tower",
            start_at: "2026-06-01T11:00:00.000Z",
            details: { source: "ai_itinerary_import", importFingerprint: a },
          },
        ],
      ),
    ).toBe(true);
  });

  it("combines trip day + time into ISO start_at", () => {
    const iso = combineDateTime("2026-06-01", 2, "09:30");
    expect(iso).toBe("2026-06-02T09:30:00.000Z");
  });
});

describe("parseItineraryTextHeuristic", () => {
  it("parses Day N schedules with times", () => {
    const text = `Day 1
9:00 AM – Breakfast at Café de Flore
11:00 AM – Visit the Eiffel Tower
Day 2
10:30 AM – Visit Notre-Dame`;
    const arr = parseItineraryTextHeuristic(text, "2026-06-01", "2026-06-03");
    expect(arr.days).toHaveLength(2);
    expect(arr.days[0]?.items[0]?.title).toMatch(/Café de Flore/i);
    expect(arr.days[0]?.items[0]?.startTime).toBe("09:00");
    expect(arr.days[1]?.date).toBe("2026-06-02");
  });
});

describe("finalizeImportArrangements", () => {
  it("produces original and optimized from AI payload", () => {
    const ai = parseImportAiPayload({
      days: [
        {
          dayNumber: 1,
          items: [
            { title: "Breakfast at Café de Flore", startTime: "09:00" },
            { title: "Visit the Eiffel Tower", startTime: "11:00" },
          ],
        },
        {
          dayNumber: 2,
          items: [{ title: "Visit Notre-Dame", startTime: "10:30" }],
        },
      ],
      warnings: [],
      changes: [],
      flags: [],
    });
    const result = finalizeImportArrangements(ai, "2026-06-01", "2026-06-03");
    expect(result.source).toBe("ai");
    expect(result.original.days[0]?.date).toBe("2026-06-01");
    expect(result.original.days[1]?.date).toBe("2026-06-02");
    expect(result.optimized.days.length).toBeGreaterThan(0);
  });
});
