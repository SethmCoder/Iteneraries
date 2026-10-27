import { getAwardWalletApiKey, getAppUrl } from "@/lib/env";

const BASE = "https://business.awardwallet.com/api/export/v2";

export type AwardWalletAccount = {
  accountId: number;
  code: string;
  displayName: string;
  kind: string;
  balance: string;
  balanceRaw: number | null;
  login?: string;
};

export type AwardWalletConnectedUser = {
  userId: number | string;
  accounts?: AwardWalletAccount[];
  accountsIndex?: Array<{ accountId: number; code?: string }>;
};

function authHeaders(): HeadersInit {
  const key = getAwardWalletApiKey();
  if (!key) throw new Error("AWARDWALLET_API_KEY is not configured");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Authentication": key,
  };
}

export function isAwardWalletConfigured(): boolean {
  return Boolean(getAwardWalletApiKey());
}

/** Create OAuth URL for user to share loyalty balances (no airline passwords to Waypoint). */
export async function createAwardWalletAuthUrl(state: string): Promise<string> {
  const redirectUrl = `${getAppUrl().replace(/\/+$/, "")}/api/loyalty/awardwallet/callback`;
  const res = await fetch(`${BASE}/create-auth-url`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      accountAccess: "read_balances",
      tripAccess: "no_access",
      awardSearchAccess: "no_access",
      sharingDefaults: {
        futureAccounts: true,
        familyMemberAccounts: false,
        familyMemberTimelines: false,
        futureFamilyMemberTimelines: false,
      },
      state,
      redirectUrl,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok || !body.url) {
    throw new Error(
      body.error ||
        body.message ||
        `AwardWallet auth URL failed (${res.status}). Ensure your business account and redirect URL are approved.`,
    );
  }
  return body.url;
}

export async function getAwardWalletConnectionUserId(
  code: string,
): Promise<string> {
  const res = await fetch(
    `${BASE}/get-connection-info/${encodeURIComponent(code)}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  const body = (await res.json().catch(() => ({}))) as {
    userId?: number | string;
    error?: string;
  };
  if (!res.ok || body.userId == null) {
    throw new Error(
      body.error ||
        `AwardWallet connection info failed (${res.status}). The code may have expired — reconnect.`,
    );
  }
  return String(body.userId);
}

export async function fetchAwardWalletConnectedUser(
  externalUserId: string,
): Promise<AwardWalletConnectedUser> {
  const res = await fetch(
    `${BASE}/connectedUser/${encodeURIComponent(externalUserId)}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  const body = (await res.json().catch(() => ({}))) as AwardWalletConnectedUser & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      body.error || `AwardWallet user fetch failed (${res.status})`,
    );
  }
  return body;
}

export function mapAwardWalletAccounts(
  user: AwardWalletConnectedUser,
): Array<{
  program: string;
  balance: number;
  currencyLabel: string;
  externalAccountId: string;
  displayName: string;
}> {
  const accounts = user.accounts ?? [];
  return accounts
    .filter((a) => a.kind === "Airlines" || !a.kind || a.balanceRaw != null)
    .map((a) => ({
      program: (a.code || a.displayName || "unknown")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 64) || "unknown",
      balance: Math.max(0, Math.round(a.balanceRaw ?? 0)),
      currencyLabel: "points",
      externalAccountId: String(a.accountId),
      displayName: a.displayName,
    }));
}
