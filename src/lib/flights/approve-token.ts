import { createHmac, timingSafeEqual } from "crypto";
import { getApproveTokenSecret } from "@/lib/env";

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export type ApproveTokenPayload = {
  userId: string;
  searchId: string;
  fingerprint: string;
  exp: number;
};

function signRaw(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function mintApproveToken(input: {
  userId: string;
  searchId: string;
  fingerprint: string;
  now?: number;
}): string {
  const secret = getApproveTokenSecret();
  if (!secret) {
    throw new Error("Approve token secret is not configured (set CRON_SECRET).");
  }
  const payload: ApproveTokenPayload = {
    userId: input.userId,
    searchId: input.searchId,
    fingerprint: input.fingerprint,
    exp: (input.now ?? Date.now()) + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signRaw(body, secret);
  return `${body}.${sig}`;
}

export function verifyApproveToken(
  token: string,
  expect: { userId: string; searchId: string; fingerprint: string },
  now = Date.now(),
): { ok: true; payload: ApproveTokenPayload } | { ok: false; error: string } {
  const secret = getApproveTokenSecret();
  if (!secret) return { ok: false, error: "Approve tokens are not configured." };

  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, error: "Invalid approve link." };

  const expectedSig = signRaw(body, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid or tampered approve link." };
    }
  } catch {
    return { ok: false, error: "Invalid approve link." };
  }

  let payload: ApproveTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ApproveTokenPayload;
  } catch {
    return { ok: false, error: "Invalid approve link." };
  }

  if (payload.exp < now) return { ok: false, error: "This approve link has expired." };
  if (payload.userId !== expect.userId) {
    return { ok: false, error: "This approve link belongs to another account." };
  }
  if (payload.searchId !== expect.searchId || payload.fingerprint !== expect.fingerprint) {
    return { ok: false, error: "Approve link does not match this award result." };
  }

  return { ok: true, payload };
}

export function buildApprovePath(input: {
  searchId: string;
  fingerprint: string;
  token: string;
}): string {
  const q = new URLSearchParams({
    searchId: input.searchId,
    fingerprint: input.fingerprint,
    token: input.token,
  });
  return `/flights/approve?${q.toString()}`;
}
