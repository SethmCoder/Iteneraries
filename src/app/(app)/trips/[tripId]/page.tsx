import { notFound, redirect } from "next/navigation";
import { ItineraryWorkspace } from "@/components/itinerary/itinerary-workspace";
import {
  DEMO_TRIP_ID,
  DEMO_USER_ID,
  demoItineraryItems,
  demoProfile,
  demoTrips,
  hasDemoSession,
  isDemoModeEnabled,
} from "@/lib/demo";
import { buildTripForwardAddress } from "@/lib/email/trip-address";
import {
  getInboundEmailAddress,
  isEmailImportConfigured,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  ItineraryItem,
  PendingFlight,
  PendingHotel,
  Profile,
  Trip,
  TripMember,
} from "@/types/database";

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

  if (isDemoModeEnabled() && (await hasDemoSession())) {
    if (tripId !== DEMO_TRIP_ID) notFound();
    const trip = demoTrips()[0];
    const inbound = getInboundEmailAddress();
    return (
      <ItineraryWorkspace
        trip={trip}
        items={demoItineraryItems()}
        members={[
          {
            id: "00000000-0000-4000-8000-000000000201",
            trip_id: DEMO_TRIP_ID,
            user_id: DEMO_USER_ID,
            role: "owner",
            invited_by: DEMO_USER_ID,
            invitation_status: "accepted",
            created_at: new Date().toISOString(),
            profiles: demoProfile(),
          },
        ]}
        role="owner"
        currentUserId={DEMO_USER_ID}
        forwardEmail={{
          configured: isEmailImportConfigured(),
          address: buildTripForwardAddress(inbound, trip.email_slug),
        }}
      />
    );
  }

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

  const [{ data: pendingFlights }, { data: pendingHotels }] = await Promise.all([
    supabase
      .from("pending_flights")
      .select("*")
      .eq("trip_id", tripId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("pending_hotels")
      .select("*")
      .eq("trip_id", tripId)
      .order("updated_at", { ascending: false }),
  ]);

  const inbound = getInboundEmailAddress();
  const typedTrip = trip as Trip;

  return (
    <ItineraryWorkspace
      trip={typedTrip}
      items={(items ?? []) as ItineraryItem[]}
      members={normalizedMembers}
      role={membership.role as "owner" | "editor" | "viewer"}
      currentUserId={user.id}
      forwardEmail={{
        configured: isEmailImportConfigured(),
        address: buildTripForwardAddress(inbound, typedTrip.email_slug),
      }}
      pendingFlights={(pendingFlights ?? []) as PendingFlight[]}
      pendingHotels={(pendingHotels ?? []) as PendingHotel[]}
    />
  );
}
