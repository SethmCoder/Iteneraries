import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAppUrl } from "@/lib/env";
import {
  fetchAwardWalletConnectedUser,
  getAwardWalletConnectionUserId,
  isAwardWalletConfigured,
  mapAwardWalletAccounts,
} from "@/lib/loyalty/awardwallet";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const appUrl = getAppUrl().replace(/\/+$/, "");
  const fail = (msg: string) =>
    NextResponse.redirect(
      `${appUrl}/flights?loyaltyError=${encodeURIComponent(msg)}`,
    );

  if (!isAwardWalletConfigured()) {
    return fail("AwardWallet is not configured");
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("aw_oauth_state")?.value;
  const userId = store.get("aw_oauth_user")?.value;

  store.delete("aw_oauth_state");
  store.delete("aw_oauth_user");

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    return fail("AwardWallet connection was cancelled or the session expired");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return fail("Sign in again, then reconnect AwardWallet");
  }

  try {
    const externalUserId = await getAwardWalletConnectionUserId(code);
    const remote = await fetchAwardWalletConnectedUser(externalUserId);
    const now = new Date().toISOString();

    await supabase.from("loyalty_connections").upsert(
      {
        user_id: user.id,
        provider: "awardwallet",
        external_user_id: externalUserId,
        access_level: "read_balances",
        status: "connected",
        last_synced_at: now,
        metadata: {},
      },
      { onConflict: "user_id,provider" },
    );

    const mapped = mapAwardWalletAccounts(remote);
    for (const account of mapped) {
      await supabase.from("loyalty_balances").upsert(
        {
          user_id: user.id,
          program: account.program,
          balance: account.balance,
          currency_label: account.currencyLabel,
          source: "verified",
          last_verified_at: now,
          provider: "awardwallet",
          external_account_id: account.externalAccountId,
        },
        { onConflict: "user_id,program" },
      );
    }

    return NextResponse.redirect(
      `${appUrl}/flights?loyaltyLinked=1&synced=${mapped.length}`,
    );
  } catch (e) {
    return fail((e as Error).message);
  }
}
