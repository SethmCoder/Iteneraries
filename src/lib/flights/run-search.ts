import { isAwardSearchConfigured } from "@/lib/env";
import {
  searchFromAwardRow,
  type AwardOption,
} from "@/lib/flights/provider";
import { getAwardProvider } from "@/lib/flights/seats-aero";
import type { AwardSearch, AwardSearchStatus } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RunSearchOutcome = {
  status: AwardSearchStatus;
  options: AwardOption[];
  error?: string;
  setupRequired?: boolean;
};

export async function executeAwardSearch(
  search: AwardSearch,
  programs: string[],
): Promise<RunSearchOutcome> {
  if (!isAwardSearchConfigured()) {
    return {
      status: "setup_required",
      options: [],
      setupRequired: true,
      error:
        "SEATS_AERO_API_KEY is not configured. Searches are saved but live award inventory is unavailable.",
    };
  }

  const provider = await getAwardProvider();
  const result = await provider.search(searchFromAwardRow(search, programs));
  if (!result.ok) {
    return {
      status: result.setupRequired ? "setup_required" : search.status === "paused" ? "paused" : "monitoring",
      options: [],
      error: result.error,
      setupRequired: result.setupRequired,
    };
  }

  return {
    status: result.options.length > 0 ? "match_found" : "monitoring",
    options: result.options,
  };
}

export async function persistAwardResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  searchId: string,
  options: AwardOption[],
) {
  const now = new Date().toISOString();
  if (options.length === 0) return;

  const rows = options.map((o) => ({
    search_id: searchId,
    airline: o.airline,
    flight_numbers: o.flightNumbers,
    origin_airport: o.originAirport,
    destination_airport: o.destinationAirport,
    depart_at: o.departAt,
    arrive_at: o.arriveAt,
    timezone: o.timezone,
    duration_minutes: o.durationMinutes,
    stops: o.stops,
    cabin: o.cabin,
    points_per_passenger: o.pointsPerPassenger,
    points_total: o.pointsTotal,
    taxes_fees: o.taxesFees,
    currency: o.currency,
    loyalty_program: o.loyaltyProgram,
    booking_url: o.bookingUrl,
    availability_status: o.availabilityStatus,
    provider: o.provider,
    provider_result_id: o.providerResultId,
    fingerprint: o.fingerprint,
    compromises: o.compromises,
    raw: o.raw,
    checked_at: now,
  }));

  await supabase.from("award_results").upsert(rows, {
    onConflict: "search_id,fingerprint",
  });
}

export async function notifyAwardMatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  search: AwardSearch,
  options: AwardOption[],
) {
  if (!search.notify_on_match || options.length === 0) return;

  const top = [...options].sort(
    (a, b) => (a.pointsPerPassenger ?? 1e12) - (b.pointsPerPassenger ?? 1e12),
  )[0];
  if (!top) return;
  if (search.last_notified_fingerprint === top.fingerprint) return;

  const message = `Award match: ${search.origin} → ${search.destination}${
    top.pointsPerPassenger != null
      ? ` from ${top.pointsPerPassenger.toLocaleString()} pts`
      : ""
  }.`;

  const { notifyUser } = await import("@/lib/notifications/notify");
  await notifyUser(supabase, {
    userId: search.user_id,
    type: "flight_match_found",
    message,
    relatedTripId: search.trip_id,
    emailSubject: `Award seat match: ${search.origin} → ${search.destination}`,
    emailHtmlBody: `<p>${message}</p><p>Review the itinerary in Flight Booker. Booking always happens on the airline site after you confirm.</p>`,
    ctaPath: "/flights",
    ctaLabel: "Open Flight Booker",
  });

  await supabase
    .from("award_searches")
    .update({ last_notified_fingerprint: top.fingerprint })
    .eq("id", search.id);
}
