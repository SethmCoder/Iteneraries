"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  allocateUniqueTripSlug,
  slugifyTripName,
} from "@/lib/email/trip-address";
import {
  planningProfileSchema,
  type PlanningProfile,
} from "@/lib/itinerary/planning-profile";
import { createClient } from "@/lib/supabase/server";

export async function createTripAction(input?: {
  name?: string | null;
  destination_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  planning_profile?: PlanningProfile;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = input?.planning_profile
    ? planningProfileSchema.parse(input.planning_profile)
    : undefined;

  const tempId = crypto.randomUUID();
  const emailSlug = await allocateUniqueTripSlug(
    supabase,
    slugifyTripName(input?.name ?? null, tempId),
  );

  const insertRow: Record<string, unknown> = {
    owner_id: user.id,
    name: input?.name?.trim() || null,
    destination_name: input?.destination_name?.trim() || null,
    start_date: input?.start_date || null,
    end_date: input?.end_date || null,
    status: "planned",
    email_slug: emailSlug,
  };
  if (profile) insertRow.planning_profile = profile;

  const { data: trip, error } = await supabase
    .from("trips")
    .insert(insertRow)
    .select("*")
    .single();

  if (error || !trip) {
    // Retry without planning_profile if column not migrated yet
    if (profile && /planning_profile/i.test(error?.message ?? "")) {
      delete insertRow.planning_profile;
      const retry = await supabase
        .from("trips")
        .insert(insertRow)
        .select("*")
        .single();
      if (retry.error || !retry.data) {
        throw new Error(retry.error?.message ?? "Failed to create trip");
      }
      await ensureOwnerMember(supabase, retry.data.id, user.id);
      revalidatePath("/trips");
      redirect(`/trips/${retry.data.id}`);
    }
    throw new Error(error?.message ?? "Failed to create trip");
  }

  await ensureOwnerMember(supabase, trip.id, user.id);

  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

async function ensureOwnerMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  userId: string,
) {
  const { error: memberError } = await supabase.from("trip_members").insert({
    trip_id: tripId,
    user_id: userId,
    role: "owner",
    invited_by: userId,
    invitation_status: "accepted",
  });
  if (memberError) {
    await supabase.from("trips").delete().eq("id", tripId);
    throw new Error(memberError.message);
  }
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
    planning_profile: planningProfileSchema.nullable().optional(),
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
