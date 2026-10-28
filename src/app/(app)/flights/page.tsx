import { FlightsPendingWorkspace } from "@/components/flights/flights-pending-workspace";
import { demoPendingFlights } from "@/lib/pending/demo";
import { demoTrips, hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { PendingFlight } from "@/types/database";

export const metadata = { title: "Flights Pending" };

export default async function FlightsPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const params = await searchParams;
  const tripId = params.tripId ?? null;

  if (isDemoModeEnabled() && (await hasDemoSession())) {
    const trips = demoTrips().map((t) => ({
      id: t.id,
      name: t.name,
      destination_name: t.destination_name,
    }));
    return (
      <FlightsPendingWorkspace
        flights={demoPendingFlights()}
        trips={trips}
        tripId={tripId}
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
    .select("trip_id, trips:trip_id(id, name, destination_name)")
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const trips = (memberRows ?? [])
    .map((row) => {
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      return trip as {
        id: string;
        name: string | null;
        destination_name: string | null;
      } | null;
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string | null;
    destination_name: string | null;
  }>;

  const { data: flights } = await supabase
    .from("pending_flights")
    .select("*")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  return (
    <FlightsPendingWorkspace
      flights={(flights ?? []) as PendingFlight[]}
      trips={trips}
      tripId={tripId}
      isDemo={false}
    />
  );
}
