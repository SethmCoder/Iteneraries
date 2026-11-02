import { describe, expect, it } from "vitest";
import {
  extractForwardedFromAddresses,
  extractOwnerEmailCandidates,
  parseEmailAddress,
  resolveUserIdByEmails,
} from "@/lib/email/identity";

describe("parseEmailAddress", () => {
  it("parses display-name form", () => {
    expect(parseEmailAddress("Seth <abcde@gmail.com>")).toBe("abcde@gmail.com");
  });

  it("parses bare addresses", () => {
    expect(parseEmailAddress("abcde@gmail.com")).toBe("abcde@gmail.com");
  });
});

describe("extractForwardedFromAddresses", () => {
  it("finds From inside a Gmail forwarded block", () => {
    const body = [
      "---------- Forwarded message ---------",
      "From: United Airlines <united@united.com>",
      "Date: Mon, Nov 2, 2026",
      "Subject: Your flight confirmation",
      "",
      "Thanks for flying",
    ].join("\n");
    expect(extractForwardedFromAddresses(body)).toContain("united@united.com");
  });
});

describe("extractOwnerEmailCandidates", () => {
  it("prefers the Gmail forwarder over airline noreply", () => {
    const ranked = extractOwnerEmailCandidates({
      from: "Seth Traveler <abcde@gmail.com>",
      replyTo: "noreply@united.com",
      text: "---------- Forwarded message ---------\nFrom: United <noreply@united.com>\n\nConfirmation",
    });
    expect(ranked[0]).toBe("abcde@gmail.com");
  });
});

describe("resolveUserIdByEmails", () => {
  it("matches auth users by email", async () => {
    const result = await resolveUserIdByEmails(
      ["abcde@gmail.com"],
      async () => ({
        users: [
          { id: "11111111-1111-4111-8111-111111111111", email: "other@x.com" },
          { id: "22222222-2222-4222-8222-222222222222", email: "abcde@gmail.com" },
        ],
        nextPage: null,
      }),
    );
    expect(result?.userId).toBe("22222222-2222-4222-8222-222222222222");
    expect(result?.matchedEmail).toBe("abcde@gmail.com");
  });
});
