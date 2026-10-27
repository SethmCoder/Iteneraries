"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { USERNAME_REGEX } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  username: z.string().regex(USERNAME_REGEX),
  display_name: z.string().max(80).nullable().optional(),
});

export async function updateProfileAction(input: z.infer<typeof profileSchema>) {
  const parsed = profileSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", parsed.username)
    .neq("id", user.id)
    .maybeSingle();
  if (taken) throw new Error("Username is already taken");

  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.username,
      display_name: parsed.display_name ?? null,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updatePreferencesAction(input: {
  preferred_transport_modes: string[];
  travel_pace: "relaxed" | "moderate" | "packed";
  interests: string[];
  distance_unit: "km" | "mi";
  timezone_display: "destination" | "home" | "utc";
  auto_confirm_imports: boolean;
  award_check_enabled?: boolean;
  award_check_timezone?: string;
  award_check_start_minute?: number;
  award_check_end_minute?: number;
  award_approve_to_book?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const start = input.award_check_start_minute;
  const end = input.award_check_end_minute;
  if (
    start != null &&
    (start < 0 || start >= 1440 || !Number.isInteger(start))
  ) {
    throw new Error("Invalid award check start time");
  }
  if (end != null && (end < 0 || end >= 1440 || !Number.isInteger(end))) {
    throw new Error("Invalid award check end time");
  }

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    ...input,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/flights");
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("avatar");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("File must be an image");
  if (file.size > 2 * 1024 * 1024) throw new Error("Image must be under 2MB");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function confirmReservationImportAction(input: {
  reviewId: string;
  tripId: string;
  extracted: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: review } = await supabase
    .from("reservation_reviews")
    .select("*, imported_emails(*)")
    .eq("id", input.reviewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!review) throw new Error("Review not found");

  const raw = input.extracted;
  const nested = Array.isArray(
    (raw as { reservations?: unknown }).reservations,
  )
    ? ((raw as { reservations: Record<string, unknown>[] }).reservations)
    : null;
  const reservations: Record<string, unknown>[] =
    nested && nested.length > 0 ? nested : [raw as Record<string, unknown>];

  for (const extracted of reservations) {
    const type = String(extracted.type ?? "other");
    const itemType =
      type === "flight"
        ? "flight"
        : type === "hotel"
          ? "hotel"
          : type === "train"
            ? "train"
            : "other";

    let title = "Imported reservation";
    let location_name: string | null = null;
    let address: string | null = null;
    let start_at: string | null = null;
    let end_at: string | null = null;
    const booking_reference =
      typeof extracted.confirmationNumber === "string"
        ? extracted.confirmationNumber
        : null;

    if (type === "flight") {
      title =
        `${String(extracted.airline ?? "Flight")} ${String(extracted.flightNumber ?? "")}`.trim();
      location_name = `${extracted.departureAirport} → ${extracted.arrivalAirport}`;
      start_at =
        typeof extracted.departureTime === "string"
          ? extracted.departureTime
          : null;
      end_at =
        typeof extracted.arrivalTime === "string"
          ? extracted.arrivalTime
          : null;
    } else if (type === "hotel") {
      title = String(extracted.hotelName ?? "Hotel");
      address =
        typeof extracted.address === "string" ? extracted.address : null;
      location_name = title;
      start_at =
        typeof extracted.checkIn === "string" ? extracted.checkIn : null;
      end_at =
        typeof extracted.checkOut === "string" ? extracted.checkOut : null;
    } else if (type === "train") {
      title =
        `${String(extracted.operator ?? "Train")} ${String(extracted.trainNumber ?? "")}`.trim();
      location_name = `${extracted.departureStation} → ${extracted.arrivalStation}`;
      start_at =
        typeof extracted.departureTime === "string"
          ? extracted.departureTime
          : null;
      end_at =
        typeof extracted.arrivalTime === "string"
          ? extracted.arrivalTime
          : null;
    }

    const { error: itemError } = await supabase.from("itinerary_items").insert({
      trip_id: input.tripId,
      created_by: user.id,
      item_type: itemType,
      title: title || "Imported reservation",
      address,
      location_name,
      start_at,
      end_at,
      booking_reference,
      details: extracted,
      sort_order: 999,
    });
    if (itemError) throw new Error(itemError.message);
  }

  await supabase
    .from("reservation_reviews")
    .update({ status: "confirmed", trip_id: input.tripId })
    .eq("id", input.reviewId);
  await supabase
    .from("imported_emails")
    .update({ status: "confirmed" })
    .eq("id", review.imported_email_id);

  revalidatePath(`/trips/${input.tripId}`);
  revalidatePath("/settings");
}

export async function rejectReservationImportAction(reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: review } = await supabase
    .from("reservation_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!review) throw new Error("Review not found");

  await supabase
    .from("reservation_reviews")
    .update({ status: "rejected" })
    .eq("id", reviewId);
  await supabase
    .from("imported_emails")
    .update({ status: "rejected" })
    .eq("id", review.imported_email_id);
  revalidatePath("/settings");
}
