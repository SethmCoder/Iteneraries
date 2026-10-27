import { describe, expect, it } from "vitest";
import {
  buildTripForwardAddress,
  extractPlusTagFromRecipients,
  slugifyTripName,
} from "@/lib/email/trip-address";

describe("trip forward addresses", () => {
  it("builds plus-addressed trip inboxes", () => {
    expect(
      buildTripForwardAddress(
        "planner@waypoint.com",
        "parisclientweek",
      ),
    ).toBe("planner+parisclientweek@waypoint.com");
  });

  it("slugifies trip names like Paris client week", () => {
    expect(slugifyTripName("Paris client week", "abc")).toBe("parisclientweek");
  });

  it("extracts plus tags from recipient headers", () => {
    expect(
      extractPlusTagFromRecipients([
        "Planner <planner+parisclientweek@waypoint.com>",
      ]),
    ).toBe("parisclientweek");
  });
});
