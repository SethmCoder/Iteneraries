/**
 * Shared helper to insert itinerary items from extracted reservation JSON.
 * Used by settings confirm action and inbound webhook auto-apply.
 */

export type ReservationInsert = {
  item_type: string;
  title: string;
  location_name: string | null;
  address: string | null;
  start_at: string | null;
  end_at: string | null;
  booking_reference: string | null;
  details: Record<string, unknown>;
};

export function reservationsFromExtracted(
  raw: Record<string, unknown>,
): Record<string, unknown>[] {
  const nested = Array.isArray(raw.reservations)
    ? (raw.reservations as Record<string, unknown>[])
    : null;
  return nested && nested.length > 0 ? nested : [raw];
}

export function buildItineraryRowsFromExtracted(
  raw: Record<string, unknown>,
): ReservationInsert[] {
  return reservationsFromExtracted(raw).map((extracted) => {
    const type = String(extracted.type ?? "other");
    const item_type =
      type === "flight"
        ? "flight"
        : type === "hotel"
          ? "hotel"
          : type === "train"
            ? "train"
            : type === "car_rental"
              ? "ground_transport"
              : type === "restaurant" ||
                  type === "activity" ||
                  type === "meeting"
                ? "place"
                : "other";

    let title = "Imported reservation";
    let location_name: string | null = null;
    let address: string | null = null;
    let start_at: string | null = null;
    let end_at: string | null = null;
    const booking_reference =
      typeof extracted.confirmationNumber === "string"
        ? extracted.confirmationNumber
        : null;

    if (type === "flight") {
      title =
        `${String(extracted.airline ?? "Flight")} ${String(extracted.flightNumber ?? "")}`.trim();
      location_name = `${extracted.departureAirport} → ${extracted.arrivalAirport}`;
      start_at =
        typeof extracted.departureTime === "string"
          ? extracted.departureTime
          : null;
      end_at =
        typeof extracted.arrivalTime === "string"
          ? extracted.arrivalTime
          : null;
    } else if (type === "hotel") {
      title = String(extracted.hotelName ?? "Hotel");
      address =
        typeof extracted.address === "string" ? extracted.address : null;
      location_name = title;
      start_at =
        typeof extracted.checkIn === "string" ? extracted.checkIn : null;
      end_at =
        typeof extracted.checkOut === "string" ? extracted.checkOut : null;
    } else if (type === "train") {
      title =
        `${String(extracted.operator ?? "Train")} ${String(extracted.trainNumber ?? "")}`.trim();
      location_name = `${extracted.departureStation} → ${extracted.arrivalStation}`;
      start_at =
        typeof extracted.departureTime === "string"
          ? extracted.departureTime
          : null;
      end_at =
        typeof extracted.arrivalTime === "string"
          ? extracted.arrivalTime
          : null;
    } else if (type === "restaurant") {
      title = String(extracted.restaurantName ?? "Restaurant");
      address =
        typeof extracted.address === "string" ? extracted.address : null;
      location_name = title;
      start_at =
        typeof extracted.reservationTime === "string"
          ? extracted.reservationTime
          : null;
    } else if (type === "car_rental") {
      title = `${String(extracted.provider ?? "Car rental")}`.trim();
      location_name = String(extracted.pickupLocation ?? "");
      address =
        typeof extracted.dropoffLocation === "string"
          ? extracted.dropoffLocation
          : null;
      start_at =
        typeof extracted.pickupTime === "string" ? extracted.pickupTime : null;
      end_at =
        typeof extracted.dropoffTime === "string"
          ? extracted.dropoffTime
          : null;
    } else if (type === "activity" || type === "meeting") {
      title = String(
        extracted.title ?? (type === "meeting" ? "Meeting" : "Activity"),
      );
      location_name =
        typeof extracted.location === "string" ? extracted.location : null;
      start_at =
        typeof extracted.startTime === "string" ? extracted.startTime : null;
      end_at =
        typeof extracted.endTime === "string" ? extracted.endTime : null;
    }

    return {
      item_type,
      title: title || "Imported reservation",
      location_name,
      address,
      start_at,
      end_at,
      booking_reference,
      details: extracted,
    };
  });
}
