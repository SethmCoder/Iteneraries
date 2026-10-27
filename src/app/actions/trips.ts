"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  allocateUniqueTripSlug,
  slugifyTripName,
} from "@/lib/email/trip-address";
import { createClient } from "@/lib/supabase/server";

export async function createTripAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tempId = crypto.randomUUID();
  const emailSlug = await allocateUniqueTripSlug(
    supabase,
    slugifyTripName(null, tempId),
  );

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      name: null,
      destination_name: null,
      status: "planned",
      email_slug: emailSlug,
    })
    .select("*")
    .single();

  if (error || !trip) {
    throw new Error(error?.message ?? "Failed to create trip");
  }

  const { error: memberError } = await supabase.from("trip_members").insert({
    trip_id: trip.id,
    user_id: user.id,
    role: "owner",
    invited_by: user.id,
    invitation_status: "accepted",
  });

  if (memberError) {
    await supabase.from("trips").delete().eq("id", trip.id);
    throw new Error(memberError.message);
  }

  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

const updateTripSchema = z
  .object({
    tripId: z.string().uuid(),
    name: z.string().max(200).nullable().optional(),
    destination_name: z.string().max(200).nullable().optional(),
    destination_latitude: z.number().nullable().optional(),
    destination_longitude: z.number().nullable().optional(),
    destination_image_url: z.string().url().nullable().optional(),
    destination_image_attribution: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      !d.start_date ||
      !d.end_date ||
      d.end_date >= d.start_date,
    { message: "End date cannot be earlier than start date" },
  );

export async function updateTripAction(input: z.infer<typeof updateTripSchema>) {
  const parsed = updateTripSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { tripId, ...rest } = parsed;
  const patch: Record<string, unknown> = { ...rest };

  if (parsed.name !== undefined) {
    const desired = slugifyTripName(parsed.name, tripId);
    patch.email_slug = await allocateUniqueTripSlug(supabase, desired, tripId);
  }

  const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
  if (error) throw new Error(error.message);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
  return { ok: true as const };
}

export async function deleteTripAction(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) throw new Error(error.message);
  revalidatePath("/trips");
  redirect("/trips");
}
