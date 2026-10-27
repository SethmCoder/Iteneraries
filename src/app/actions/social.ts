"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function searchUsersAction(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const q = query.trim();
  if (q.length < 2) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, display_name")
    .ilike("username", `%${q}%`)
    .neq("id", user.id)
    .limit(10);
  return data ?? [];
}

export async function sendFriendRequestAction(username: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: recipient } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", username.trim())
    .maybeSingle();
  if (!recipient) throw new Error("User not found");
  if (recipient.id === user.id) throw new Error("You cannot friend yourself");

  const { error } = await supabase.from("friends").insert({
    requester_id: user.id,
    recipient_id: recipient.id,
    status: "pending",
  });
  if (error) {
    if (error.code === "23505") throw new Error("Friend request already exists");
    throw new Error(error.message);
  }

  await supabase.from("notifications").insert({
    user_id: recipient.id,
    actor_id: user.id,
    type: "friend_request",
    message: "You received a friend request",
  });

  revalidatePath("/social");
}

export async function respondFriendRequestAction(
  friendshipId: string,
  status: "accepted" | "rejected",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: row } = await supabase
    .from("friends")
    .select("*")
    .eq("id", friendshipId)
    .single();
  if (!row || row.recipient_id !== user.id) throw new Error("Not allowed");

  const { error } = await supabase
    .from("friends")
    .update({ status })
    .eq("id", friendshipId);
  if (error) throw new Error(error.message);

  if (status === "accepted") {
    await supabase.from("notifications").insert({
      user_id: row.requester_id,
      actor_id: user.id,
      type: "friend_accepted",
      message: "Your friend request was accepted",
    });
  }

  revalidatePath("/social");
}

export async function removeFriendAction(friendshipId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
  if (error) throw new Error(error.message);
  revalidatePath("/social");
}

const inviteSchema = z.object({
  tripId: z.string().uuid(),
  username: z.string().min(3),
  role: z.enum(["editor", "viewer"]),
});

export async function inviteCollaboratorAction(
  input: z.infer<typeof inviteSchema>,
) {
  const parsed = inviteSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", parsed.username)
    .maybeSingle();
  if (!profile) throw new Error("User not found");

  const { data: friendship } = await supabase
    .from("friends")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${user.id},recipient_id.eq.${profile.id}),and(requester_id.eq.${profile.id},recipient_id.eq.${user.id})`,
    )
    .maybeSingle();
  if (!friendship) throw new Error("You can only invite existing friends");

  const { error } = await supabase.from("trip_members").insert({
    trip_id: parsed.tripId,
    user_id: profile.id,
    role: parsed.role,
    invited_by: user.id,
    invitation_status: "pending",
  });
  if (error) {
    if (error.code === "23505") throw new Error("User is already a collaborator");
    throw new Error(error.message);
  }

  await supabase.from("notifications").insert({
    user_id: profile.id,
    actor_id: user.id,
    type: "trip_invitation",
    message: "You were invited to collaborate on a trip",
    related_trip_id: parsed.tripId,
  });

  revalidatePath(`/trips/${parsed.tripId}`);
  revalidatePath("/social");
}

export async function respondInvitationAction(
  memberId: string,
  status: "accepted" | "declined",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: row } = await supabase
    .from("trip_members")
    .select("*")
    .eq("id", memberId)
    .single();
  if (!row || row.user_id !== user.id) throw new Error("Not allowed");

  const { error } = await supabase
    .from("trip_members")
    .update({ invitation_status: status })
    .eq("id", memberId);
  if (error) throw new Error(error.message);

  if (status === "accepted" && row.invited_by) {
    await supabase.from("notifications").insert({
      user_id: row.invited_by,
      actor_id: user.id,
      type: "trip_invitation_accepted",
      message: "Your trip invitation was accepted",
      related_trip_id: row.trip_id,
    });
  }

  revalidatePath("/social");
  revalidatePath(`/trips/${row.trip_id}`);
}

export async function removeCollaboratorAction(
  tripId: string,
  memberId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("id", memberId)
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);
  revalidatePath(`/trips/${tripId}`);
}
