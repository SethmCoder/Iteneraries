import { ItinerarySuggesterWorkspace } from "@/components/suggester/itinerary-suggester-workspace";
import { demoTrips, hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { parsePlanningProfile } from "@/lib/itinerary/planning-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Itinerary Suggester" };

export default async function SuggesterPage({
  searchParams,
}: {
  searchParams: Promise<{ listIds?: string; tripId?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const initialListIds = (params.listIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mode =
    params.mode === "major" || params.mode === "lesser"
      ? params.mode
      : "full";

  if (isDemoModeEnabled() && (await hasDemoSession())) {
    const trips = demoTrips().map((t) => ({
      id: t.id,
      name: t.name,
      destination_name: t.destination_name,
      start_date: t.start_date,
      end_date: t.end_date,
    }));
    return (
      <ItinerarySuggesterWorkspace
        trips={trips}
        lists={[]}
        initialListIds={initialListIds}
        initialTripId={params.tripId ?? trips[0]?.id}
        initialMode={mode}
        initialMustDos=""
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
      "trip_id, trips:trip_id(id, name, destination_name, start_date, end_date, planning_profile)",
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
        planning_profile?: unknown;
      } | null;
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string | null;
    destination_name: string | null;
    start_date: string | null;
    end_date: string | null;
    planning_profile?: unknown;
  }>;

  const initialTripId =
    params.tripId && trips.some((t) => t.id === params.tripId)
      ? params.tripId
      : trips[0]?.id;
  const selected = trips.find((t) => t.id === initialTripId);
  const profile = parsePlanningProfile(selected?.planning_profile);
  const initialMustDos = (profile.mustDos ?? []).join(", ");

  const { data: ownLists } = await supabase
    .from("place_lists")
    .select("id, name")
    .eq("owner_id", user!.id);

  const { data: shares } = await supabase
    .from("place_list_shares")
    .select("list_id")
    .eq("friend_user_id", user!.id);

  const sharedIds = (shares ?? []).map((s) => s.list_id as string);
  let sharedLists: Array<{ id: string; name: string }> = [];
  if (sharedIds.length) {
    const { data } = await supabase
      .from("place_lists")
      .select("id, name")
      .in("id", sharedIds);
    sharedLists = (data ?? []) as Array<{ id: string; name: string }>;
  }

  const lists = [
    ...((ownLists ?? []) as Array<{ id: string; name: string }>).map((l) => ({
      ...l,
      isShared: false,
    })),
    ...sharedLists.map((l) => ({ ...l, isShared: true })),
  ];

  return (
    <ItinerarySuggesterWorkspace
      trips={trips}
      lists={lists}
      initialListIds={initialListIds}
      initialTripId={initialTripId}
      initialMode={mode}
      initialMustDos={initialMustDos}
      isDemo={false}
    />
  );
}
