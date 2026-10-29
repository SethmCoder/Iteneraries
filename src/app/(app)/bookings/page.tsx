import { BookingsWorkspace } from "@/components/bookings/bookings-workspace";
import { demoPendingFlights, demoPendingHotels } from "@/lib/pending/demo";
import { demoTrips, hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type {
  PendingActivity,
  PendingCar,
  PendingFlight,
  PendingHotel,
} from "@/types/database";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({
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
      <BookingsWorkspace
        flights={demoPendingFlights()}
        hotels={demoPendingHotels()}
        cars={[]}
        activities={[]}
        trips={trips}
        tripId={tripId}
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

  const [{ data: flights }, { data: hotels }, carsRes, activitiesRes] =
    await Promise.all([
      supabase
        .from("pending_flights")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("pending_hotels")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("pending_cars")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("pending_activities")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false }),
    ]);

  return (
    <BookingsWorkspace
      flights={(flights ?? []) as PendingFlight[]}
      hotels={(hotels ?? []) as PendingHotel[]}
      cars={
        carsRes.error ? [] : ((carsRes.data ?? []) as PendingCar[])
      }
      activities={
        activitiesRes.error
          ? []
          : ((activitiesRes.data ?? []) as PendingActivity[])
      }
      trips={trips}
      tripId={tripId}
    />
  );
}
