import { describe, expect, it } from "vitest";
import { buildDeterministicDrafts } from "@/lib/itinerary/deterministic-drafts";

describe("buildDeterministicDrafts", () => {
  it("returns three distinct draft lenses", () => {
    const drafts = buildDeterministicDrafts({
      destination: "Kyoto",
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      mustDos: ["Fushimi Inari", "Arashiyama"],
      pace: "balanced",
    });
    expect(drafts).toHaveLength(3);
    expect(new Set(drafts.map((d) => d.id)).size).toBe(3);
    expect(drafts[0]!.days.length).toBeGreaterThanOrEqual(1);
    expect(drafts.every((d) => d.notes?.includes("No flights"))).toBe(true);
    const titles = drafts.flatMap((d) =>
      d.days.flatMap((day) => day.items.map((i) => i.title)),
    );
    expect(titles.some((t) => /free time \/ buffer/i.test(t))).toBe(false);
  });

  it("includes user must-dos without inventing prices", () => {
    const drafts = buildDeterministicDrafts({
      destination: "Paris",
      mustDos: ["Louvre"],
    });
    const titles = drafts.flatMap((d) =>
      d.days.flatMap((day) => day.items.map((i) => i.title)),
    );
    expect(titles).toContain("Louvre");
    expect(JSON.stringify(drafts)).not.toMatch(/\$\d/);
  });
});
