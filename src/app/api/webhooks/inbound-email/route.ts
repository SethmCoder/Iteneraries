import { NextResponse } from "next/server";
import { extractReservationFromEmail } from "@/lib/ai/extract-reservation";
import { buildItineraryRowsFromExtracted } from "@/lib/email/apply-reservation";
import {
  extractOwnerEmailCandidates,
  parseEmailAddress,
  resolveUserIdByEmails,
} from "@/lib/email/identity";
import { matchTripForReservation } from "@/lib/email/match-trip";
import { normalizeBookingKey } from "@/lib/email/normalize";
import {
  allocateUniqueTripSlug,
  slugifyTripName,
} from "@/lib/email/trip-address";
import { verifyResendWebhook } from "@/lib/email/webhook";
import { isAiConfigured, isEmailImportConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

function fieldAsString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const obj = value as { address?: unknown; email?: unknown };
    if (typeof obj.address === "string" && obj.address.trim()) {
      return obj.address.trim();
    }
    if (typeof obj.email === "string" && obj.email.trim()) {
      return obj.email.trim();
    }
  }
  return null;
}

function fieldAsStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(fieldAsString).filter((v): v is string => Boolean(v));
  }
  const single = fieldAsString(value);
  return single ? [single] : [];
}

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

  const fromAddress = fieldAsString(data.from);
  const replyTo = fieldAsStringList(
    (data as { reply_to?: unknown }).reply_to ??
      (data as { replyTo?: unknown }).replyTo,
  );
  const rawText =
    typeof data.text === "string" && data.text.trim() ? data.text : null;
  const rawHtml =
    typeof data.html === "string" && data.html.trim() ? data.html : null;
  const subject =
    typeof data.subject === "string" ? data.subject : null;

  // Map forwarder / original sender → Waypoint account (e.g. abcde@gmail.com)
  if (!userId) {
    const candidates = extractOwnerEmailCandidates({
      from: fromAddress,
      replyTo,
      subject,
      text: rawText,
      html: rawHtml,
    });
    const resolved = await resolveUserIdByEmails(candidates, async (page) => {
      const { data: users } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      const list = users.users ?? [];
      return {
        users: list.map((u) => ({ id: u.id, email: u.email })),
        nextPage: list.length < 200 ? null : page + 1,
      };
    });
    userId = resolved?.userId ?? null;
  }

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "Unable to associate email with a user. Forward to your Waypoint plus-address, or forward from the same email as your Waypoint login.",
      },
      { status: 422 },
    );
  }

  const { data: imported, error: importError } = await admin
    .from("imported_emails")
    .insert({
      user_id: userId,
      provider_message_id: messageId,
      status: "processing",
      subject,
      from_address: parseEmailAddress(fromAddress) ?? fromAddress,
      raw_text: rawText,
      raw_html: rawHtml,
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
    const body = rawText || rawHtml || "";
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

    const extractedRecord = extracted as unknown as Record<string, unknown>;

    // Load trips + light itinerary context for timeline/type matching
    const { data: ownedTrips } = await admin
      .from("trips")
      .select("id, name, destination_name, start_date, end_date")
      .eq("owner_id", userId);

    const tripIds = (ownedTrips ?? []).map((t) => t.id as string);
    const itemTypesByTrip = new Map<string, string[]>();
    const itemDaysByTrip = new Map<string, string[]>();
    if (tripIds.length > 0) {
      const { data: items } = await admin
        .from("itinerary_items")
        .select("trip_id, item_type, start_at")
        .in("trip_id", tripIds);
      for (const item of items ?? []) {
        const tid = item.trip_id as string;
        const types = itemTypesByTrip.get(tid) ?? [];
        if (typeof item.item_type === "string") types.push(item.item_type);
        itemTypesByTrip.set(tid, types);
        if (typeof item.start_at === "string" && item.start_at.length >= 10) {
          const days = itemDaysByTrip.get(tid) ?? [];
          days.push(item.start_at.slice(0, 10));
          itemDaysByTrip.set(tid, days);
        }
      }
    }

    const tripsForMatch = (ownedTrips ?? []).map((t) => ({
      id: t.id as string,
      name: (t.name as string | null) ?? null,
      destination_name: (t.destination_name as string | null) ?? null,
      start_date: (t.start_date as string | null) ?? null,
      end_date: (t.end_date as string | null) ?? null,
      item_types: itemTypesByTrip.get(t.id as string) ?? [],
      item_days: [...new Set(itemDaysByTrip.get(t.id as string) ?? [])],
    }));

    const match = await matchTripForReservation({
      trips: tripsForMatch,
      extracted: extractedRecord,
      preferTripId: tripId,
    });

    let resolvedTripId = match.tripId;
    let matchReason = match.reason;

    if (!resolvedTripId && match.createTrip) {
      const emailSlug = await allocateUniqueTripSlug(
        admin,
        slugifyTripName(match.createTrip.name, crypto.randomUUID()),
      );
      const { data: newTrip, error: tripErr } = await admin
        .from("trips")
        .insert({
          owner_id: userId,
          name: match.createTrip.name,
          destination_name: match.createTrip.destination_name,
          start_date: match.createTrip.start_date,
          end_date: match.createTrip.end_date,
          status: "planned",
          email_slug: emailSlug,
        })
        .select("id")
        .single();
      if (!tripErr && newTrip) {
        await admin.from("trip_members").insert({
          trip_id: newTrip.id,
          user_id: userId,
          role: "owner",
          invited_by: userId,
          invitation_status: "accepted",
        });
        resolvedTripId = newTrip.id;
        matchReason = `created_trip: ${match.reason}`;
      }
    }

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("auto_confirm_imports")
      .eq("user_id", userId)
      .maybeSingle();

    const autoConfirm = Boolean(prefs?.auto_confirm_imports);

    const { data: review, error: reviewErr } = await admin
      .from("reservation_reviews")
      .insert({
        imported_email_id: imported.id,
        user_id: userId,
        trip_id: resolvedTripId,
        extracted_data: extracted,
        status: autoConfirm && resolvedTripId ? "confirmed" : "pending",
        match_reason: matchReason,
        matched_trip_confidence: match.confidence,
      })
      .select("id")
      .single();

    if (reviewErr) throw new Error(reviewErr.message);

    if (autoConfirm && resolvedTripId && review) {
      const rows = buildItineraryRowsFromExtracted(extractedRecord);
      for (const row of rows) {
        await admin.from("itinerary_items").insert({
          trip_id: resolvedTripId,
          created_by: userId,
          item_type: row.item_type,
          title: row.title,
          address: row.address,
          location_name: row.location_name,
          start_at: row.start_at,
          end_at: row.end_at,
          booking_reference: row.booking_reference,
          details: { ...row.details, source: "email_import" },
          sort_order: 999,
        });
      }
      await admin
        .from("imported_emails")
        .update({
          status: "confirmed",
          processed_at: new Date().toISOString(),
          normalized_booking_key: bookingKey || null,
        })
        .eq("id", imported.id);
    } else {
      await admin
        .from("imported_emails")
        .update({
          status: "ready_for_review",
          processed_at: new Date().toISOString(),
          normalized_booking_key: bookingKey || null,
        })
        .eq("id", imported.id);
    }

    await admin.from("notifications").insert({
      user_id: userId,
      type: "import_ready",
      message: autoConfirm
        ? "A forwarded reservation was added to a trip."
        : "A forwarded reservation is ready for review on Forwarded Emails.",
    });

    return NextResponse.json({ ok: true, tripId: resolvedTripId });
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
      message: "Reservation import failed. Open Forwarded Emails to review.",
    });

    return NextResponse.json(
      { ok: false, error: "Processing failed" },
      { status: 500 },
    );
  }
}
