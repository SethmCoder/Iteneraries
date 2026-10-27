"use server";

import { revalidatePath } from "next/cache";
import {
  fetchAwardWalletConnectedUser,
  isAwardWalletConfigured,
  mapAwardWalletAccounts,
} from "@/lib/loyalty/awardwallet";
import {
  isWebParseConfigured,
  parseLoyaltyAccount,
} from "@/lib/loyalty/web-parse";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { LOYALTY_PROGRAMS } from "@/lib/flights/loyalty-programs";

export async function linkLoyaltyProgramAction(input: {
  program: string;
  username: string;
  password: string;
}) {
  if (!isWebParseConfigured()) {
    throw new Error(
      "In-app program linking is not configured. Set AWARDWALLET_WEB_USER and AWARDWALLET_WEB_PASSWORD.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const limited = rateLimit(`loyalty-parse:${user.id}`, 5, 60 * 60_000);
  if (!limited.ok) {
    throw new Error("Too many balance link attempts. Try again later.");
  }

  const programOk = LOYALTY_PROGRAMS.some((p) => p.id === input.program);
  if (!programOk) throw new Error("Unsupported loyalty program.");

  // Never log credentials — parseLoyaltyAccount uses them in-memory only.
  const parsed = await parseLoyaltyAccount({
    program: input.program,
    username: input.username,
    password: input.password,
  });

  const now = new Date().toISOString();
  const { error } = await supabase.from("loyalty_balances").upsert(
    {
      user_id: user.id,
      program: input.program,
      balance: parsed.balance,
      currency_label: parsed.currencyLabel,
      source: "verified",
      last_verified_at: now,
      provider: "awardwallet_parse",
      external_account_id: parsed.externalAccountId,
    },
    { onConflict: "user_id,program" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/flights");
  revalidatePath("/settings");
  return {
    program: input.program,
    balance: parsed.balance,
  };
}

/** Same as link — credentials must be re-entered; nothing is stored. */
export async function syncLoyaltyProgramAction(input: {
  program: string;
  username: string;
  password: string;
}) {
  return linkLoyaltyProgramAction(input);
}

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
