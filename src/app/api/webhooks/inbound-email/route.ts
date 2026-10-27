import { NextResponse } from "next/server";
import { extractReservationFromEmail } from "@/lib/ai/extract-reservation";
import { normalizeBookingKey } from "@/lib/email/normalize";
import { verifyResendWebhook } from "@/lib/email/webhook";
import { isAiConfigured, isEmailImportConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!isEmailImportConfigured()) {
    return NextResponse.json(
      { error: "Inbound email is not configured" },
      { status: 503 },
    );
  }

  const limited = rateLimit("webhook:inbound-email", 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const payload = await request.text();

  let event;
  try {
    event = verifyResendWebhook(payload, request.headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role key required for email import" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const data = event.data;
  const messageId =
    typeof data.email_id === "string"
      ? data.email_id
      : typeof data.id === "string"
        ? data.id
        : null;
  if (!messageId) {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("imported_emails")
    .select("id")
    .eq("provider_message_id", messageId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const toField = data.to;
  const recipients = Array.isArray(toField)
    ? toField.map(String)
    : typeof toField === "string"
      ? [toField]
      : [];

  const { extractPlusTagFromRecipients } = await import(
    "@/lib/email/trip-address"
  );
  const plusTag = extractPlusTagFromRecipients(recipients);

  let userId: string | null = null;
  let tripId: string | null = null;

  if (plusTag) {
    const { data: trip } = await admin
      .from("trips")
      .select("id, owner_id")
      .eq("email_slug", plusTag)
      .maybeSingle();
    if (trip) {
      tripId = trip.id as string;
      userId = trip.owner_id as string;
    } else {
      const { data: alias } = await admin
        .from("email_aliases")
        .select("user_id")
        .eq("alias_token", plusTag)
        .maybeSingle();
      userId = alias?.user_id ?? null;
    }
  }

  const fromAddress =
    typeof data.from === "string"
      ? data.from
      : typeof (data.from as { address?: string } | undefined)?.address ===
          "string"
        ? (data.from as { address: string }).address
        : null;

  if (!userId && fromAddress) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = users.users.find(
      (u) => u.email?.toLowerCase() === fromAddress.toLowerCase(),
    );
    userId = match?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Unable to associate email with a user" },
      { status: 422 },
    );
  }

  const { data: imported, error: importError } = await admin
    .from("imported_emails")
    .insert({
      user_id: userId,
      provider_message_id: messageId,
      status: "processing",
      subject: typeof data.subject === "string" ? data.subject : null,
      from_address: fromAddress,
    })
    .select("*")
    .single();

  if (importError || !imported) {
    return NextResponse.json({ error: "Failed to store email" }, { status: 500 });
  }

  try {
    if (!isAiConfigured()) {
      throw new Error("AI not configured for extraction");
    }
    const body =
      (typeof data.text === "string" && data.text) ||
      (typeof data.html === "string" && data.html) ||
      "";
    const subject = typeof data.subject === "string" ? data.subject : undefined;
    const extracted = await extractReservationFromEmail(body, subject);
    const bookingKey = normalizeBookingKey(extracted);

    if (bookingKey) {
      const { data: dup } = await admin
        .from("imported_emails")
        .select("id")
        .eq("user_id", userId)
        .eq("normalized_booking_key", bookingKey)
        .neq("id", imported.id)
        .maybeSingle();
      if (dup) {
        await admin
          .from("imported_emails")
          .update({
            status: "error",
            processing_error: "Duplicate reservation",
            processed_at: new Date().toISOString(),
            normalized_booking_key: bookingKey,
          })
          .eq("id", imported.id);
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    await admin.from("reservation_reviews").insert({
      imported_email_id: imported.id,
      user_id: userId,
      trip_id: tripId,
      extracted_data: extracted,
      status: "pending",
    });

    await admin
      .from("imported_emails")
      .update({
        status: "ready_for_review",
        processed_at: new Date().toISOString(),
        normalized_booking_key: bookingKey || null,
      })
      .eq("id", imported.id);

    await admin.from("notifications").insert({
      user_id: userId,
      type: "import_ready",
      message: "A forwarded reservation is ready for review.",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await admin
      .from("imported_emails")
      .update({
        status: "error",
        processing_error: (e as Error).message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", imported.id);

    await admin.from("notifications").insert({
      user_id: userId,
      type: "import_error",
      message: "Reservation import failed. Open Settings to retry.",
    });

    return NextResponse.json({ ok: false, error: "Processing failed" }, { status: 500 });
  }
}
