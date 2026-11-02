/**
 * Routes that leave the trip itinerary page for another app surface.
 * Keep query params aligned with guided planning (`from=plan`) where used.
 */

export type LeaveItineraryTarget =
  | "flights"
  | "hotels"
  | "activities"
  | "bookings"
  | "saved-places";

export function leaveItineraryHref(
  target: LeaveItineraryTarget,
  tripId: string,
  opts?: { mode?: "major" | "lesser" },
): string {
  switch (target) {
    case "flights":
      return `/flights?tripId=${tripId}&from=plan`;
    case "hotels":
      return `/hotels?tripId=${tripId}&from=plan`;
    case "activities":
      return `/suggester?tripId=${tripId}&mode=${opts?.mode ?? "major"}`;
    case "bookings":
      return `/bookings?tripId=${tripId}`;
    case "saved-places":
      return "/saved-places";
  }
}

/** Trip section nav entries that navigate away from the itinerary page. */
export const LEAVE_TRIP_SECTIONS = [
  { id: "flights" as const, label: "Flights", target: "flights" as const },
  { id: "hotels" as const, label: "Hotels", target: "hotels" as const },
  {
    id: "activities" as const,
    label: "Activities",
    target: "activities" as const,
  },
  { id: "bookings" as const, label: "Bookings", target: "bookings" as const },
];

export function isLeaveTripSection(
  id: string,
): id is (typeof LEAVE_TRIP_SECTIONS)[number]["id"] {
  return LEAVE_TRIP_SECTIONS.some((s) => s.id === id);
}
