"use server";

import { revalidatePath } from "next/cache";
import {
  pendingActivitySchema,
  pendingCarSchema,
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
    flight_number: emptyToNull(parsed.flightNumber ?? null),
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
  revalidatePath("/bookings");
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
  revalidatePath("/bookings");
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
  revalidatePath("/bookings");
  return { ok: true as const };
}

export async function savePendingCarAction(input: unknown) {
  const parsed = pendingCarSchema.parse(input);
  const { supabase, user } = await requireUser();
  await assertTripAccess(supabase, user.id, parsed.tripId);

  const payload = {
    user_id: user.id,
    trip_id: parsed.tripId,
    provider: emptyToNull(parsed.provider ?? null),
    pickup_location: emptyToNull(parsed.pickupLocation ?? null),
    dropoff_location: emptyToNull(parsed.dropoffLocation ?? null),
    pickup_at: emptyToNull(parsed.pickupAt ?? null),
    dropoff_at: emptyToNull(parsed.dropoffAt ?? null),
    booking_status: parsed.bookingStatus,
    booking_url: emptyToNull(parsed.bookingUrl ?? null),
    confirmation_number: emptyToNull(parsed.confirmationNumber ?? null),
    notes: emptyToNull(parsed.notes ?? null),
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("pending_cars")
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("pending_cars").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/bookings");
  return { ok: true as const };
}

export async function deletePendingCarAction(id: string) {
  z.string().uuid().parse(id);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("pending_cars")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/bookings");
  return { ok: true as const };
}

export async function savePendingActivityAction(input: unknown) {
  const parsed = pendingActivitySchema.parse(input);
  const { supabase, user } = await requireUser();
  await assertTripAccess(supabase, user.id, parsed.tripId);

  const payload = {
    user_id: user.id,
    trip_id: parsed.tripId,
    title: parsed.title.trim(),
    activity_type: parsed.activityType,
    location: emptyToNull(parsed.location ?? null),
    start_at: emptyToNull(parsed.startAt ?? null),
    end_at: emptyToNull(parsed.endAt ?? null),
    booking_status: parsed.bookingStatus,
    booking_url: emptyToNull(parsed.bookingUrl ?? null),
    confirmation_number: emptyToNull(parsed.confirmationNumber ?? null),
    notes: emptyToNull(parsed.notes ?? null),
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("pending_activities")
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("pending_activities").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/bookings");
  revalidatePath(`/trips/${parsed.tripId}`);
  return { ok: true as const };
}

export async function deletePendingActivityAction(id: string) {
  z.string().uuid().parse(id);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("pending_activities")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/bookings");
  return { ok: true as const };
}
