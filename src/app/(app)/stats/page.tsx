import { StatsWorkspace } from "@/components/stats/stats-workspace";
import { demoTrips, hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { ItineraryItem, Trip } from "@/types/database";

export const metadata = { title: "Travel stats" };

export default async function StatsPage() {
  if (isDemoModeEnabled() && (await hasDemoSession())) {
    return (
      <StatsWorkspace trips={demoTrips() as Trip[]} flightItems={[]} />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("trip_id, trips:trip_id(*)")
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const trips = (memberRows ?? [])
    .map((row) => {
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      return trip as Trip | null;
    })
    .filter(Boolean) as Trip[];

  const tripIds = trips.map((t) => t.id);
  let flightItems: ItineraryItem[] = [];
  if (tripIds.length) {
    const { data } = await supabase
      .from("itinerary_items")
      .select("*")
      .in("trip_id", tripIds)
      .eq("item_type", "flight");
    flightItems = (data ?? []) as ItineraryItem[];
  }

  return <StatsWorkspace trips={trips} flightItems={flightItems} />;
}
