"use server";

import { revalidatePath } from "next/cache";
import {
  fetchAwardWalletConnectedUser,
  isAwardWalletConfigured,
  mapAwardWalletAccounts,
} from "@/lib/loyalty/awardwallet";
import { createClient } from "@/lib/supabase/server";

export async function syncAwardWalletBalancesAction() {
  if (!isAwardWalletConfigured()) {
    throw new Error(
      "AwardWallet is not configured. Set AWARDWALLET_API_KEY after creating a Business account.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: connection, error } = await supabase
    .from("loyalty_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "awardwallet")
    .eq("status", "connected")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!connection) {
    throw new Error("Connect AwardWallet first to sync live point balances.");
  }

  const remote = await fetchAwardWalletConnectedUser(
    connection.external_user_id,
  );
  const mapped = mapAwardWalletAccounts(remote);
  const now = new Date().toISOString();

  for (const account of mapped) {
    const { error: upsertError } = await supabase.from("loyalty_balances").upsert(
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
    if (upsertError) throw new Error(upsertError.message);
  }

  await supabase
    .from("loyalty_connections")
    .update({ last_synced_at: now, status: "connected" })
    .eq("id", connection.id);

  revalidatePath("/flights");
  revalidatePath("/settings");
  return { count: mapped.length };
}

export async function disconnectAwardWalletAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("loyalty_connections")
    .update({ status: "disconnected" })
    .eq("user_id", user.id)
    .eq("provider", "awardwallet");

  revalidatePath("/flights");
  return { ok: true as const };
}
