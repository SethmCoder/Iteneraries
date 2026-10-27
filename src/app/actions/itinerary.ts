"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(1).max(300),
  item_type: z.enum([
    "place",
    "flight",
    "hotel",
    "train",
    "ground_transport",
    "other",
  ]),
  description: z.string().nullable().optional(),
  location_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  booking_reference: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  osm_id: z.string().nullable().optional(),
  sort_order: z.number().optional(),
});

export async function addItineraryItemAction(input: z.infer<typeof itemSchema>) {
  const parsed = itemSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (parsed.osm_id) {
    const { data: existing } = await supabase
      .from("itinerary_items")
      .select("id")
      .eq("trip_id", parsed.tripId)
      .eq("osm_id", parsed.osm_id)
      .maybeSingle();
    if (existing) {
      return { ok: true as const, item: existing, duplicate: true as const };
    }
  }

  const { data: maxRow } = await supabase
    .from("itinerary_items")
    .select("sort_order")
    .eq("trip_id", parsed.tripId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = parsed.sort_order ?? (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("itinerary_items")
    .insert({
      trip_id: parsed.tripId,
      created_by: user.id,
      title: parsed.title,
      item_type: parsed.item_type,
      description: parsed.description ?? null,
      location_name: parsed.location_name ?? null,
      address: parsed.address ?? null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      start_at: parsed.start_at ?? null,
      end_at: parsed.end_at ?? null,
      timezone: parsed.timezone ?? null,
      booking_reference: parsed.booking_reference ?? null,
      source_url: parsed.source_url ?? null,
      thumbnail_url: parsed.thumbnail_url ?? null,
      details: parsed.details ?? {},
      osm_id: parsed.osm_id ?? null,
      sort_order,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await notifyCollaborators(
    supabase,
    parsed.tripId,
    user.id,
    `added “${parsed.title}” to the itinerary`,
    "itinerary_item_added",
    data.id,
  );

  revalidatePath(`/trips/${parsed.tripId}`);
  return { ok: true as const, item: data, duplicate: false as const };
}

const updateSchema = itemSchema.partial().extend({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
});

export async function updateItineraryItemAction(
  input: z.infer<typeof updateSchema>,
) {
  const parsed = updateSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { id, tripId, ...rest } = parsed;
  const { data, error } = await supabase
    .from("itinerary_items")
    .update(rest)
    .eq("id", id)
    .eq("trip_id", tripId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await notifyCollaborators(
    supabase,
    tripId,
    user.id,
    `updated “${data.title}”`,
    "itinerary_item_edited",
    id,
  );

  revalidatePath(`/trips/${tripId}`);
  return { ok: true as const, item: data };
}

export async function deleteItineraryItemAction(tripId: string, itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);

  revalidatePath(`/trips/${tripId}`);
  return { ok: true as const };
}

export async function reorderItineraryItemsAction(
  tripId: string,
  orderedIds: string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("itinerary_items")
        .update({ sort_order: index + 1 })
        .eq("id", id)
        .eq("trip_id", tripId),
    ),
  );

  revalidatePath(`/trips/${tripId}`);
  return { ok: true as const };
}

async function notifyCollaborators(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  actorId: string,
  message: string,
  type: string,
  itemId?: string,
) {
  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("invitation_status", "accepted")
    .neq("user_id", actorId);

  if (!members?.length) return;

  await supabase.from("notifications").insert(
    members.map((m: { user_id: string }) => ({
      user_id: m.user_id,
      actor_id: actorId,
      type,
      message,
      related_trip_id: tripId,
      related_item_id: itemId ?? null,
    })),
  );
}
