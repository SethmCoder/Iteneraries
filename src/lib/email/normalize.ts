import type {
  ExtractedReservation,
  ReservationExtract,
} from "@/lib/ai/extract-reservation";

function norm(value: string | undefined | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function datePart(value: string | undefined | null): string {
  return (value ?? "").slice(0, 10);
}

function keyForReservation(extracted: ExtractedReservation): string {
  const confirmation = norm(extracted.confirmationNumber);

  switch (extracted.type) {
    case "flight":
      return [
        "flight",
        confirmation || norm(extracted.airline),
        norm(extracted.flightNumber) ||
          `${norm(extracted.departureAirport)}-${norm(extracted.arrivalAirport)}`,
        datePart(extracted.departureTime),
      ].join(":");
    case "train":
      return [
        "train",
        confirmation || norm(extracted.operator),
        norm(extracted.trainNumber) ||
          `${norm(extracted.departureStation)}-${norm(extracted.arrivalStation)}`,
        datePart(extracted.departureTime),
      ].join(":");
    case "hotel":
      return [
        "hotel",
        confirmation,
        norm(extracted.hotelName),
        datePart(extracted.checkIn),
      ].join(":");
    case "restaurant":
      return [
        "restaurant",
        confirmation,
        norm(extracted.restaurantName),
        datePart(extracted.reservationTime),
      ].join(":");
    case "car_rental":
      return [
        "car",
        confirmation || norm(extracted.provider),
        norm(extracted.pickupLocation),
        datePart(extracted.pickupTime),
      ].join(":");
    case "activity":
      return [
        "activity",
        confirmation,
        norm(extracted.title),
        datePart(extracted.startTime),
      ].join(":");
    case "meeting":
      return [
        "meeting",
        confirmation,
        norm(extracted.title),
        datePart(extracted.startTime),
      ].join(":");
  }
}

/**
 * Build a stable key for deduplicating imported reservations. Accepts a single
 * reservation or the full extraction result. The same booking forwarded twice
 * yields the same key; separate legs/stays differ. Returns "" when there is
 * nothing to key on.
 */
export function normalizeBookingKey(
  extracted: ExtractedReservation | ReservationExtract,
): string {
  if ("reservations" in extracted) {
    return extracted.reservations
      .map(keyForReservation)
      .sort()
      .join("|");
  }
  return keyForReservation(extracted);
}
