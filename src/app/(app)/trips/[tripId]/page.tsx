import { notFound, redirect } from "next/navigation";
import { ItineraryWorkspace } from "@/components/itinerary/itinerary-workspace";
import { createClient } from "@/lib/supabase/server";
import type { ItineraryItem, Profile, Trip, TripMember } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return { title: `Trip ${tripId.slice(0, 8)}` };
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("trip_members")
    .select("role, invitation_status")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.invitation_status !== "accepted") {
    notFound();
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const { data: items } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });

  const { data: members } = await supabase
    .from("trip_members")
    .select("*, profiles:user_id(*)")
    .eq("trip_id", tripId);

  const normalizedMembers = ((members ?? []) as unknown as (TripMember & {
    profiles: Profile | Profile[] | null;
  })[]).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }));

  return (
    <ItineraryWorkspace
      trip={trip as Trip}
      items={(items ?? []) as ItineraryItem[]}
      members={normalizedMembers}
      role={membership.role as "owner" | "editor" | "viewer"}
      currentUserId={user.id}
    />
  );
}
