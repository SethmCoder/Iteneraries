import { describe, expect, it } from "vitest";
import {
  isInAwardCheckWindow,
  localMinutesInTimezone,
  minutesToTimeInput,
  timeInputToMinutes,
} from "@/lib/flights/award-check-window";
import {
  buildApprovePath,
  mintApproveToken,
  verifyApproveToken,
} from "@/lib/flights/approve-token";
import {
  awardWalletProviderForProgram,
  waypointProgramFromProvider,
} from "@/lib/loyalty/program-codes";

describe("program code mapping", () => {
  it("maps Waypoint programs to AwardWallet providers", () => {
    expect(awardWalletProviderForProgram("singapore")).toBe("singapore");
    expect(awardWalletProviderForProgram("american")).toBe("aa");
    expect(awardWalletProviderForProgram("alaska")).toBe("alaskaair");
  });

  it("maps providers back to Waypoint ids", () => {
    expect(waypointProgramFromProvider("aa")).toBe("american");
    expect(waypointProgramFromProvider("singapore")).toBe("singapore");
    expect(waypointProgramFromProvider("krisflyer")).toBe("singapore");
  });
});

describe("award check window", () => {
  it("converts time inputs", () => {
    expect(timeInputToMinutes("18:00")).toBe(1080);
    expect(minutesToTimeInput(1260)).toBe("21:00");
  });

  it("is open when disabled", () => {
    expect(
      isInAwardCheckWindow(new Date(), {
        award_check_enabled: false,
        award_check_timezone: "UTC",
        award_check_start_minute: 0,
        award_check_end_minute: 60,
      }),
    ).toBe(true);
  });

  it("handles same-day and overnight windows in UTC", () => {
    const noon = new Date("2026-06-15T12:00:00.000Z");
    expect(localMinutesInTimezone(noon, "UTC")).toBe(12 * 60);

    expect(
      isInAwardCheckWindow(noon, {
        award_check_enabled: true,
        award_check_timezone: "UTC",
        award_check_start_minute: 11 * 60,
        award_check_end_minute: 13 * 60,
      }),
    ).toBe(true);

    expect(
      isInAwardCheckWindow(noon, {
        award_check_enabled: true,
        award_check_timezone: "UTC",
        award_check_start_minute: 18 * 60,
        award_check_end_minute: 21 * 60,
      }),
    ).toBe(false);

    const late = new Date("2026-06-15T23:00:00.000Z");
    expect(
      isInAwardCheckWindow(late, {
        award_check_enabled: true,
        award_check_timezone: "UTC",
        award_check_start_minute: 22 * 60,
        award_check_end_minute: 1 * 60,
      }),
    ).toBe(true);

    const morning = new Date("2026-06-15T00:30:00.000Z");
    expect(
      isInAwardCheckWindow(morning, {
        award_check_enabled: true,
        award_check_timezone: "UTC",
        award_check_start_minute: 22 * 60,
        award_check_end_minute: 1 * 60,
      }),
    ).toBe(true);
  });
});

describe("approve tokens", () => {
  it("mints and verifies a bound token", () => {
    process.env.CRON_SECRET = "test-cron-secret-for-approve";
    const token = mintApproveToken({
      userId: "user-1",
      searchId: "11111111-1111-1111-1111-111111111111",
      fingerprint: "fp-abc",
    });
    const path = buildApprovePath({
      searchId: "11111111-1111-1111-1111-111111111111",
      fingerprint: "fp-abc",
      token,
    });
    expect(path.startsWith("/flights/approve?")).toBe(true);

    const ok = verifyApproveToken(token, {
      userId: "user-1",
      searchId: "11111111-1111-1111-1111-111111111111",
      fingerprint: "fp-abc",
    });
    expect(ok.ok).toBe(true);

    const badUser = verifyApproveToken(token, {
      userId: "other",
      searchId: "11111111-1111-1111-1111-111111111111",
      fingerprint: "fp-abc",
    });
    expect(badUser.ok).toBe(false);

    const expired = mintApproveToken({
      userId: "user-1",
      searchId: "11111111-1111-1111-1111-111111111111",
      fingerprint: "fp-abc",
      now: Date.now() - 3 * 60 * 60 * 1000,
    });
    const expiredCheck = verifyApproveToken(
      expired,
      {
        userId: "user-1",
        searchId: "11111111-1111-1111-1111-111111111111",
        fingerprint: "fp-abc",
      },
      Date.now(),
    );
    expect(expiredCheck.ok).toBe(false);
  });
});
