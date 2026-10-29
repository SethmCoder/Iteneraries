import { ItinerarySuggesterWorkspace } from "@/components/suggester/itinerary-suggester-workspace";
import { demoTrips, hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Itinerary Suggester" };

export default async function SuggesterPage() {
  if (isDemoModeEnabled() && (await hasDemoSession())) {
    return (
      <ItinerarySuggesterWorkspace
        trips={demoTrips().map((t) => ({
          id: t.id,
          name: t.name,
          destination_name: t.destination_name,
          start_date: t.start_date,
          end_date: t.end_date,
        }))}
        isDemo
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberRows } = await supabase
    .from("trip_members")
    .select(
      "trip_id, trips:trip_id(id, name, destination_name, start_date, end_date)",
    )
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const trips = (memberRows ?? [])
    .map((row) => {
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      return trip as {
        id: string;
        name: string | null;
        destination_name: string | null;
        start_date: string | null;
        end_date: string | null;
      } | null;
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string | null;
    destination_name: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;

  return <ItinerarySuggesterWorkspace trips={trips} isDemo={false} />;
}
