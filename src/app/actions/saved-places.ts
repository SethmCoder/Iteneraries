"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolvePlaceQuery } from "@/lib/places/resolve";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function createPlaceListAction(input: {
  name: string;
  description?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("List name is required");
  const { data, error } = await supabase
    .from("place_lists")
    .insert({
      owner_id: user.id,
      name,
      description: input.description?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
  return data;
}

export async function renamePlaceListAction(input: {
  listId: string;
  name: string;
  description?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("place_lists")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .eq("id", input.listId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}

export async function deletePlaceListAction(listId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("place_lists")
    .delete()
    .eq("id", listId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}

const placeInputSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().min(1),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  osm_type: z.string().nullable().optional(),
  osm_id: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  enrich: z.boolean().optional(),
});

export async function addPlaceToListAction(
  input: z.infer<typeof placeInputSchema>,
) {
  const parsed = placeInputSchema.parse(input);
  const { supabase, user } = await requireUser();

  let openingHours: string | null = null;
  let category = parsed.category ?? null;
  let lat = parsed.latitude ?? null;
  let lon = parsed.longitude ?? null;
  let address = parsed.address ?? null;
  let osmType = parsed.osm_type ?? null;
  let osmId = parsed.osm_id ?? null;

  if (parsed.enrich !== false) {
    try {
      const resolved = await resolvePlaceQuery(parsed.name);
      if (resolved) {
        openingHours = resolved.openingHoursRaw;
        category = category ?? resolved.category;
        lat = lat ?? resolved.lat;
        lon = lon ?? resolved.lon;
        address = address ?? resolved.address;
        osmType = osmType ?? resolved.osmType;
        osmId = osmId ?? resolved.osmId;
      }
    } catch {
      // Keep geocode fields from client
    }
  }

  let placeId: string | null = null;
  if (osmType && osmId) {
    const { data: existing } = await supabase
      .from("places")
      .select("id")
      .eq("osm_type", osmType)
      .eq("osm_id", osmId)
      .maybeSingle();
    if (existing) placeId = existing.id;
  }

  if (!placeId) {
    const { data: created, error } = await supabase
      .from("places")
      .insert({
        name: parsed.name,
        latitude: lat,
        longitude: lon,
        address,
        osm_type: osmType,
        osm_id: osmId,
        category,
        opening_hours_raw: openingHours,
        metadata: {},
      })
      .select("id")
      .single();
    if (error) {
      // Unique race — fetch again
      if (osmType && osmId) {
        const { data: again } = await supabase
          .from("places")
          .select("id")
          .eq("osm_type", osmType)
          .eq("osm_id", osmId)
          .maybeSingle();
        if (again) placeId = again.id;
      }
      if (!placeId) throw new Error(error.message);
    } else {
      placeId = created.id;
    }
  } else if (openingHours) {
    await supabase
      .from("places")
      .update({ opening_hours_raw: openingHours, category })
      .eq("id", placeId);
  }

  const { data: item, error: itemError } = await supabase
    .from("place_list_items")
    .upsert(
      {
        list_id: parsed.listId,
        place_id: placeId!,
        notes: parsed.notes ?? null,
        source_url: parsed.source_url ?? null,
        added_by: user.id,
      },
      { onConflict: "list_id,place_id" },
    )
    .select("*, places(*)")
    .single();
  if (itemError) throw new Error(itemError.message);
  revalidatePath("/saved-places");
  return item;
}

export async function removePlaceFromListAction(itemId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("place_list_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}

export async function updatePlaceListItemAction(input: {
  itemId: string;
  notes?: string | null;
  source_url?: string | null;
}) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("place_list_items")
    .update({
      notes: input.notes ?? null,
      source_url: input.source_url ?? null,
    })
    .eq("id", input.itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}

export async function copyPlaceToListAction(input: {
  placeId: string;
  targetListId: string;
  notes?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("place_list_items").upsert(
    {
      list_id: input.targetListId,
      place_id: input.placeId,
      notes: input.notes ?? null,
      added_by: user.id,
    },
    { onConflict: "list_id,place_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}

export async function movePlaceToListAction(input: {
  itemId: string;
  targetListId: string;
}) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase
    .from("place_list_items")
    .select("*")
    .eq("id", input.itemId)
    .maybeSingle();
  if (!item) throw new Error("Item not found");
  await copyPlaceToListAction({
    placeId: item.place_id,
    targetListId: input.targetListId,
    notes: item.notes,
  });
  await supabase.from("place_list_items").delete().eq("id", input.itemId);
  void user;
  revalidatePath("/saved-places");
}

export async function sharePlaceListAction(input: {
  listId: string;
  friendUserId: string;
  permission: "view" | "edit";
}) {
  const { supabase, user } = await requireUser();
  const { data: list } = await supabase
    .from("place_lists")
    .select("id")
    .eq("id", input.listId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!list) throw new Error("List not found");

  const { error } = await supabase.from("place_list_shares").upsert(
    {
      list_id: input.listId,
      friend_user_id: input.friendUserId,
      permission: input.permission,
    },
    { onConflict: "list_id,friend_user_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}

export async function unsharePlaceListAction(input: {
  listId: string;
  friendUserId: string;
}) {
  const { supabase, user } = await requireUser();
  const { data: list } = await supabase
    .from("place_lists")
    .select("id")
    .eq("id", input.listId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!list) throw new Error("List not found");
  const { error } = await supabase
    .from("place_list_shares")
    .delete()
    .eq("list_id", input.listId)
    .eq("friend_user_id", input.friendUserId);
  if (error) throw new Error(error.message);
  revalidatePath("/saved-places");
}
