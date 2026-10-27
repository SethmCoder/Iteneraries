import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTransactionalEmail, wrapEmail } from "@/lib/email/send";
import { getAppUrl, isOutboundEmailConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email(),
});

/**
 * Prefer Resend + admin recovery link when outbound email is configured.
 * Falls back to Supabase Auth's built-in reset email otherwise.
 */
export async function POST(request: Request) {
  const limited = rateLimit("forgot-password", 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let email: string;
  try {
    const json = await request.json();
    email = bodySchema.parse(json).email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const redirectTo = `${getAppUrl().replace(/\/+$/, "")}/auth/reset-password`;

  if (isOutboundEmailConfigured() && hasServiceRole()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

      // Always return ok to avoid email enumeration
      if (!error && data?.properties?.action_link) {
        const wrapped = wrapEmail(
          "Reset your Waypoint password",
          "<p>We received a request to reset your password.</p><p>This link expires soon. If you did not request it, you can ignore this email.</p>",
          { label: "Reset password", href: data.properties.action_link },
        );
        await sendTransactionalEmail({
          to: email,
          subject: "Reset your Waypoint password",
          html: wrapped.html,
          text: wrapped.text,
        });
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: true });
    }
  }

  // Fallback: Supabase-managed email (configure SMTP in Supabase dashboard)
  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    via: "supabase",
    hint: isOutboundEmailConfigured()
      ? undefined
      : "Configure RESEND_API_KEY and RESEND_FROM_EMAIL for Waypoint-sent reset emails.",
  });
}
