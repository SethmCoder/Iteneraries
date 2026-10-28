import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import {
  appLink,
  sendTransactionalEmail,
  wrapEmail,
} from "@/lib/email/send";
import { isOutboundEmailConfigured } from "@/lib/env";
import type { NotificationType } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotifyInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  message: string;
  relatedTripId?: string | null;
  relatedItemId?: string | null;
  emailSubject?: string;
  emailHtmlBody?: string;
  ctaPath?: string;
  ctaLabel?: string;
};

async function resolveUserEmail(userId: string): Promise<string | null> {
  if (!hasServiceRole()) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

function defaultCta(type: NotificationType): { path: string; label: string } {
  if (type.startsWith("flight")) return { path: "/flights", label: "Open Flights Pending" };
  if (type.startsWith("friend")) return { path: "/social", label: "Open Social" };
  if (type.startsWith("import")) return { path: "/settings?tab=imports", label: "Review import" };
  if (type.startsWith("account_")) return { path: "/settings?tab=account", label: "Manage account" };
  if (type.startsWith("trip") || type.startsWith("itinerary")) {
    return { path: "/trips", label: "Open trips" };
  }
  return { path: "/trips", label: "Open Waypoint" };
}

/**
 * Inserts an in-app notification and, when Resend is configured, emails the
 * recipient's auth email address. Failures to send email do not throw.
 */
export async function notifyUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  input: NotifyInput,
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    type: input.type,
    message: input.message,
    related_trip_id: input.relatedTripId ?? null,
    related_item_id: input.relatedItemId ?? null,
  });

  if (!isOutboundEmailConfigured()) return;

  const email = await resolveUserEmail(input.userId);
  if (!email) return;

  const cta = defaultCta(input.type);
  const path = input.ctaPath ?? cta.path;
  const label = input.ctaLabel ?? cta.label;
  const subject = input.emailSubject ?? `Waypoint: ${input.message}`;
  const body =
    input.emailHtmlBody ??
    `<p>${input.message}</p><p>You can also see this in your Waypoint notification bell.</p>`;
  const wrapped = wrapEmail(subject.replace(/^Waypoint:\s*/i, ""), body, {
    label,
    href: appLink(path),
  });

  await sendTransactionalEmail({
    to: email,
    subject,
    html: wrapped.html,
    text: wrapped.text,
  });
}

export async function notifyUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  inputs: NotifyInput[],
): Promise<void> {
  for (const input of inputs) {
    await notifyUser(supabase, input);
  }
}
