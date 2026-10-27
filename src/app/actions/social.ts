"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyUser } from "@/lib/notifications/notify";
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

  await notifyUser(supabase, {
    userId: recipient.id,
    actorId: user.id,
    type: "friend_request",
    message: "You received a friend request",
    emailSubject: "New friend request on Waypoint",
    emailHtmlBody:
      "<p>Someone sent you a friend request on Waypoint.</p><p>Open Social to accept or decline.</p>",
    ctaPath: "/social",
    ctaLabel: "Open Social",
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
    await notifyUser(supabase, {
      userId: row.requester_id,
      actorId: user.id,
      type: "friend_accepted",
      message: "Your friend request was accepted",
      emailSubject: "Friend request accepted",
      emailHtmlBody: "<p>Your Waypoint friend request was accepted.</p>",
      ctaPath: "/social",
      ctaLabel: "Open Social",
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

  await notifyUser(supabase, {
    userId: profile.id,
    actorId: user.id,
    type: "trip_invitation",
    message: "You were invited to collaborate on a trip",
    relatedTripId: parsed.tripId,
    emailSubject: "Trip collaboration invite",
    emailHtmlBody:
      "<p>You were invited to collaborate on a trip in Waypoint.</p>",
    ctaPath: `/trips/${parsed.tripId}`,
    ctaLabel: "Open trip",
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
    await notifyUser(supabase, {
      userId: row.invited_by,
      actorId: user.id,
      type: "trip_invitation_accepted",
      message: "Your trip invitation was accepted",
      relatedTripId: row.trip_id,
      emailSubject: "Trip invitation accepted",
      emailHtmlBody: "<p>Your trip collaboration invite was accepted.</p>",
      ctaPath: `/trips/${row.trip_id}`,
      ctaLabel: "Open trip",
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
