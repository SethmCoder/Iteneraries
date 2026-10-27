"use server";

import { revalidatePath } from "next/cache";
import { nextPeriodEnd } from "@/lib/billing/period";
import { notifyUser } from "@/lib/notifications/notify";
import { createClient } from "@/lib/supabase/server";
import type { AccountBilling } from "@/types/database";

/**
 * Free renew: extends the current period by 30 days.
 * Paid-ready: when plan is `pro` and billing_provider is `stripe`, this should
 * not silently grant free time — Stripe webhooks will call the same period math
 * via an admin path later. For now only `free` + manual renew is allowed.
 */
export async function renewAccountAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: billing, error } = await supabase
    .from("account_billing")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = billing as AccountBilling | null;
  if (row?.plan === "pro" && row.billing_provider === "stripe") {
    throw new Error(
      "This account is billed through Stripe. Paid renewal portal is not enabled yet.",
    );
  }

  const now = new Date();
  const currentEnd = row?.current_period_end ?? now.toISOString();
  const periodEnd = nextPeriodEnd(currentEnd, now);

  const payload = {
    plan: "free" as const,
    status: "active" as const,
    billing_provider: "manual" as const,
    current_period_start:
      row?.status === "active" && row.current_period_start
        ? row.current_period_start
        : now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    delete_after: null,
    last_renewed_at: now.toISOString(),
    reminder_stage: "none" as const,
  };

  if (row) {
    const { error: updateError } = await supabase
      .from("account_billing")
      .update(payload)
      .eq("user_id", user.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await supabase.from("account_billing").insert({
      user_id: user.id,
      ...payload,
    });
    if (insertError) throw new Error(insertError.message);
  }

  await notifyUser(supabase, {
    userId: user.id,
    type: "account_renewed",
    message: `Your Waypoint access was renewed through ${periodEnd.toLocaleDateString()}.`,
    emailSubject: "Waypoint access renewed",
    emailHtmlBody: `<p>Your free access period was renewed.</p><p>Your new period ends on <strong>${periodEnd.toUTCString()}</strong>.</p>`,
    ctaPath: "/settings?tab=account",
    ctaLabel: "View account",
  });

  revalidatePath("/settings");
  revalidatePath("/trips");
  return { periodEnd: periodEnd.toISOString() };
}

export async function getAccountBillingAction(): Promise<AccountBilling | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data } = await supabase
    .from("account_billing")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as AccountBilling | null) ?? null;
}
