import { NextResponse } from "next/server";
import {
  ACCOUNT_DELETE_GRACE_DAYS,
} from "@/lib/billing/constants";
import {
  daysUntil,
  deleteAfterFromPeriodEnd,
} from "@/lib/billing/period";
import { getCronSecret, isOutboundEmailConfigured } from "@/lib/env";
import { notifyUser } from "@/lib/notifications/notify";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { AccountBilling } from "@/types/database";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data: rows, error } = await admin.from("account_billing").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let reminded = 0;
  let expired = 0;
  let deleted = 0;

  for (const raw of rows ?? []) {
    const billing = raw as AccountBilling;
    const days = daysUntil(billing.current_period_end, now);

    // Hard-delete after grace
    if (
      billing.status === "expired" &&
      billing.delete_after &&
      new Date(billing.delete_after).getTime() <= now.getTime()
    ) {
      const { error: delError } = await admin.auth.admin.deleteUser(
        billing.user_id,
      );
      if (!delError) deleted += 1;
      continue;
    }

    // Mark expired at period end
    if (
      billing.status === "active" &&
      new Date(billing.current_period_end).getTime() <= now.getTime()
    ) {
      const deleteAfter = deleteAfterFromPeriodEnd(
        new Date(billing.current_period_end),
      );
      await admin
        .from("account_billing")
        .update({
          status: "expired",
          delete_after: deleteAfter.toISOString(),
          reminder_stage: "expired",
          last_reminder_at: now.toISOString(),
        })
        .eq("user_id", billing.user_id);

      await notifyUser(admin, {
        userId: billing.user_id,
        type: "account_expired",
        message: `Your Waypoint access expired. Renew within ${ACCOUNT_DELETE_GRACE_DAYS} days to keep your account.`,
        emailSubject: "Your Waypoint access has expired",
        emailHtmlBody: `<p>Your access period ended.</p><p>Press <strong>Renew</strong> in Settings within ${ACCOUNT_DELETE_GRACE_DAYS} days or your account and data will be deleted.</p>`,
        ctaPath: "/settings?tab=account",
        ctaLabel: "Renew access",
      });
      expired += 1;
      continue;
    }

    if (billing.status !== "active") continue;

    // 7-day reminder
    if (days <= 7 && days > 1 && billing.reminder_stage === "none") {
      await admin
        .from("account_billing")
        .update({
          reminder_stage: "d7",
          last_reminder_at: now.toISOString(),
        })
        .eq("user_id", billing.user_id);
      await notifyUser(admin, {
        userId: billing.user_id,
        type: "account_renewal_reminder",
        message: `Your Waypoint access ends in ${days} day(s). Renew to keep your account.`,
        emailSubject: "Renew your Waypoint access soon",
        emailHtmlBody: `<p>Your free access period ends in about <strong>${days} days</strong>.</p><p>Open Settings and press Renew to extend another 30 days. If you do not renew, the account will expire and then be deleted.</p>`,
        ctaPath: "/settings?tab=account",
        ctaLabel: "Renew now",
      });
      reminded += 1;
      continue;
    }

    // 1-day reminder
    if (days <= 1 && days >= 0 && billing.reminder_stage !== "d1" && billing.reminder_stage !== "expired") {
      await admin
        .from("account_billing")
        .update({
          reminder_stage: "d1",
          last_reminder_at: now.toISOString(),
        })
        .eq("user_id", billing.user_id);
      await notifyUser(admin, {
        userId: billing.user_id,
        type: "account_renewal_reminder",
        message: "Your Waypoint access ends tomorrow. Renew to avoid deletion.",
        emailSubject: "Last day to renew Waypoint",
        emailHtmlBody:
          "<p>Your access period ends within a day.</p><p>Renew in Settings to extend 30 days. After expiry, your account will be deleted following a short grace period.</p>",
        ctaPath: "/settings?tab=account",
        ctaLabel: "Renew now",
      });
      reminded += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    reminded,
    expired,
    deleted,
    emailConfigured: isOutboundEmailConfigured(),
  });
}
