import { describe, expect, it } from "vitest";
import { ACCOUNT_PERIOD_DAYS } from "@/lib/billing/constants";
import {
  daysUntil,
  isAccessAllowed,
  nextPeriodEnd,
} from "@/lib/billing/period";

describe("billing period helpers", () => {
  it("extends from the later of now or current end", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    const future = nextPeriodEnd("2026-11-10T12:00:00Z", now);
    expect(future.toISOString().slice(0, 10)).toBe("2026-12-10");

    const past = nextPeriodEnd("2026-10-01T12:00:00Z", now);
    const expected = new Date(now);
    expected.setUTCDate(expected.getUTCDate() + ACCOUNT_PERIOD_DAYS);
    expect(past.toISOString().slice(0, 10)).toBe(
      expected.toISOString().slice(0, 10),
    );
  });

  it("blocks expired status even if period end is in the future", () => {
    expect(
      isAccessAllowed("expired", "2099-01-01T00:00:00Z"),
    ).toBe(false);
    expect(
      isAccessAllowed("active", "2099-01-01T00:00:00Z"),
    ).toBe(true);
  });

  it("computes days until period end", () => {
    const now = new Date("2026-10-27T00:00:00Z");
    expect(daysUntil("2026-10-30T00:00:00Z", now)).toBe(3);
  });
});
