import { NewItineraryButton } from "@/components/trips/new-itinerary-button";
import { TripsWorkspace } from "@/components/trips/trips-workspace";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Trip, TripMember } from "@/types/database";

export const metadata = { title: "Trips" };

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("trip_members")
    .select("trip_id, role, invitation_status")
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const tripIds = (memberships ?? []).map((m) => m.trip_id);
  let trips: Trip[] = [];
  const membersByTrip: Record<string, Profile[]> = {};

  if (tripIds.length) {
    const { data: tripRows } = await supabase
      .from("trips")
      .select("*")
      .in("id", tripIds)
      .order("updated_at", { ascending: false });
    trips = tripRows ?? [];

    const { data: allMembers } = await supabase
      .from("trip_members")
      .select("trip_id, user_id, invitation_status, profiles:user_id(*)")
      .in("trip_id", tripIds)
      .eq("invitation_status", "accepted");

    for (const row of (allMembers ?? []) as unknown as (TripMember & {
      profiles: Profile | Profile[] | null;
    })[]) {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;
      if (!profile) continue;
      membersByTrip[row.trip_id] = membersByTrip[row.trip_id] ?? [];
      membersByTrip[row.trip_id].push(profile);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your trips</h1>
          <p className="text-sm text-muted">
            Plan itineraries and explore destinations on the map.
          </p>
        </div>
        <NewItineraryButton className="hidden sm:inline-flex" />
      </div>
      <TripsWorkspace trips={trips} membersByTrip={membersByTrip} />
    </div>
  );
}
