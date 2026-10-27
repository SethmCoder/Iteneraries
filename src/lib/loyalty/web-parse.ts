import { getAwardWalletWebAuth } from "@/lib/env";
import {
  awardWalletProviderForProgram,
  waypointProgramFromProvider,
} from "@/lib/loyalty/program-codes";

const BASE = "https://loyalty.awardwallet.com/v2";

export type ParsedLoyaltyAccount = {
  program: string;
  balance: number;
  currencyLabel: string;
  externalAccountId: string;
  displayName: string;
  providerCode: string;
};

type CheckSubmitResponse = {
  requestId?: string;
  message?: string;
  errorReason?: string;
};

type CheckResultResponse = {
  requestId?: string;
  state?: number;
  message?: string;
  errorReason?: string;
  provider?: string;
  balance?: number | string | null;
  login?: string;
};

function webAuthHeaders(): HeadersInit {
  const auth = getAwardWalletWebAuth();
  if (!auth) {
    throw new Error(
      "AwardWallet Web Parsing is not configured. Set AWARDWALLET_WEB_USER and AWARDWALLET_WEB_PASSWORD (or AWARDWALLET_WEB_AUTH).",
    );
  }
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Authentication": auth,
  };
}

export function isWebParseConfigured(): boolean {
  return Boolean(getAwardWalletWebAuth());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBalance(raw: number | string | null | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return 0;
}

function stateError(state: number, body: CheckResultResponse): string {
  const userMsg = body.message?.trim();
  switch (state) {
    case 2:
      return userMsg || "Invalid loyalty login or password.";
    case 3:
      return userMsg || "Loyalty account is locked after too many login attempts.";
    case 4:
      return userMsg || "Provider requires additional account action before we can read the balance.";
    case 5:
      return "This loyalty program is temporarily unavailable.";
    case 10:
      return userMsg || "Additional verification is required on the airline site. Complete it, then try again.";
    default:
      return userMsg || "Could not retrieve loyalty balance. Try again later.";
  }
}

/**
 * Submit airline credentials to AwardWallet Web Parsing and poll until balance is ready.
 * Credentials are never stored — only used for this request.
 */
export async function parseLoyaltyAccount(input: {
  program: string;
  username: string;
  password: string;
}): Promise<ParsedLoyaltyAccount> {
  const provider = awardWalletProviderForProgram(input.program);
  if (!provider) throw new Error("Unsupported loyalty program.");

  const login = input.username.trim();
  const password = input.password;
  if (!login || !password) throw new Error("Username and password are required.");

  const submit = await fetch(`${BASE}/account/check`, {
    method: "POST",
    headers: webAuthHeaders(),
    body: JSON.stringify({
      provider,
      login,
      password,
    }),
    cache: "no-store",
  });

  const submitBody = (await submit.json().catch(() => ({}))) as CheckSubmitResponse;
  if (!submit.ok || !submitBody.requestId) {
    throw new Error(
      submitBody.message ||
        submitBody.errorReason ||
        `Balance check failed to start (${submit.status}).`,
    );
  }

  const requestId = submitBody.requestId;
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    await sleep(2500);
    const res = await fetch(
      `${BASE}/account/check/${encodeURIComponent(requestId)}`,
      { headers: webAuthHeaders(), cache: "no-store" },
    );
    const body = (await res.json().catch(() => ({}))) as CheckResultResponse;
    if (!res.ok) {
      throw new Error(
        body.message || body.errorReason || `Balance poll failed (${res.status}).`,
      );
    }

    const state = body.state ?? 0;
    if (state === 0) continue;
    if (state === 1 || state === 9) {
      const providerCode = body.provider || provider;
      return {
        program: waypointProgramFromProvider(providerCode) || input.program,
        balance: parseBalance(body.balance),
        currencyLabel: "points",
        externalAccountId: requestId,
        displayName: providerCode,
        providerCode,
      };
    }
    throw new Error(stateError(state, body));
  }

  throw new Error("Loyalty balance check timed out. Try again in a few minutes.");
}
