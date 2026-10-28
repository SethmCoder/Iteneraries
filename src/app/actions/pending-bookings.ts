"use server";

import { revalidatePath } from "next/cache";
import {
  pendingFlightSchema,
  pendingHotelSchema,
} from "@/lib/pending/schema";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function assertTripAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  tripId: string,
) {
  const { data } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .eq("invitation_status", "accepted")
    .maybeSingle();
  if (!data) throw new Error("Trip not found or access denied");
}

function emptyToNull(v: string | null | undefined) {
  if (v == null || v === "") return null;
  return v;
}

export async function savePendingFlightAction(input: unknown) {
  const parsed = pendingFlightSchema.parse(input);
  const { supabase, user } = await requireUser();
  await assertTripAccess(supabase, user.id, parsed.tripId);

  const payload = {
    user_id: user.id,
    trip_id: parsed.tripId,
    origin: parsed.origin.toUpperCase(),
    destination: parsed.destination.toUpperCase(),
    depart_date: emptyToNull(parsed.departDate ?? null),
    return_date: emptyToNull(parsed.returnDate ?? null),
    passengers: parsed.passengers,
    airline: emptyToNull(parsed.airline ?? null),
    booking_status: parsed.bookingStatus,
    booking_url: emptyToNull(parsed.bookingUrl ?? null),
    notes: emptyToNull(parsed.notes ?? null),
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("pending_flights")
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("pending_flights").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/flights");
  revalidatePath("/hotels");
  return { ok: true as const };
}

export async function deletePendingFlightAction(id: string) {
  z.string().uuid().parse(id);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("pending_flights")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/flights");
  return { ok: true as const };
}

export async function savePendingHotelAction(input: unknown) {
  const parsed = pendingHotelSchema.parse(input);
  const { supabase, user } = await requireUser();
  await assertTripAccess(supabase, user.id, parsed.tripId);

  const payload = {
    user_id: user.id,
    trip_id: parsed.tripId,
    hotel_name: parsed.hotelName.trim(),
    location: emptyToNull(parsed.location ?? null),
    check_in: emptyToNull(parsed.checkIn ?? null),
    check_out: emptyToNull(parsed.checkOut ?? null),
    rooms: parsed.rooms,
    guests: parsed.guests,
    booking_status: parsed.bookingStatus,
    booking_url: emptyToNull(parsed.bookingUrl ?? null),
    notes: emptyToNull(parsed.notes ?? null),
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("pending_hotels")
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("pending_hotels").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/hotels");
  revalidatePath("/flights");
  return { ok: true as const };
}

export async function deletePendingHotelAction(id: string) {
  z.string().uuid().parse(id);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("pending_hotels")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/hotels");
  return { ok: true as const };
}
