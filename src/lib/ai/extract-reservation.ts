import { z } from "zod";
import { chatJson } from "@/lib/ai/client";

const optionalString = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

/** ISO 8601 local date-time ("YYYY-MM-DDTHH:mm") or date ("YYYY-MM-DD"). */
const isoDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/, "Expected an ISO date or date-time");

const optionalIsoDateTime = z
  .string()
  .nullish()
  .transform((v) =>
    v && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(v.trim())
      ? v.trim()
      : undefined,
  );

const passengers = z
  .array(z.string())
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const flightReservationSchema = z.object({
  type: z.literal("flight"),
  confirmationNumber: optionalString,
  airline: optionalString,
  flightNumber: optionalString,
  departureAirport: z.string().min(1),
  arrivalAirport: z.string().min(1),
  departureTime: isoDateTime,
  arrivalTime: optionalIsoDateTime,
  passengerNames: passengers,
});

export const hotelReservationSchema = z.object({
  type: z.literal("hotel"),
  confirmationNumber: optionalString,
  hotelName: z.string().min(1),
  address: optionalString,
  checkIn: isoDateTime,
  checkOut: isoDateTime,
  guestNames: passengers,
});

export const trainReservationSchema = z.object({
  type: z.literal("train"),
  confirmationNumber: optionalString,
  operator: optionalString,
  trainNumber: optionalString,
  departureStation: z.string().min(1),
  arrivalStation: z.string().min(1),
  departureTime: isoDateTime,
  arrivalTime: optionalIsoDateTime,
  passengerNames: passengers,
});

export const restaurantReservationSchema = z.object({
  type: z.literal("restaurant"),
  confirmationNumber: optionalString,
  restaurantName: z.string().min(1),
  address: optionalString,
  reservationTime: optionalIsoDateTime,
  partySize: z.number().int().positive().nullish().transform((v) => v ?? undefined),
  guestNames: passengers,
});

export const carRentalReservationSchema = z.object({
  type: z.literal("car_rental"),
  confirmationNumber: optionalString,
  provider: optionalString,
  pickupLocation: z.string().min(1),
  dropoffLocation: optionalString,
  pickupTime: isoDateTime,
  dropoffTime: optionalIsoDateTime,
  guestNames: passengers,
});

export const activityReservationSchema = z.object({
  type: z.literal("activity"),
  confirmationNumber: optionalString,
  title: z.string().min(1),
  location: optionalString,
  startTime: optionalIsoDateTime,
  endTime: optionalIsoDateTime,
  guestNames: passengers,
});

export const meetingReservationSchema = z.object({
  type: z.literal("meeting"),
  confirmationNumber: optionalString,
  title: z.string().min(1),
  location: optionalString,
  startTime: optionalIsoDateTime,
  endTime: optionalIsoDateTime,
  guestNames: passengers,
});

export const reservationItemSchema = z.discriminatedUnion("type", [
  flightReservationSchema,
  hotelReservationSchema,
  trainReservationSchema,
  restaurantReservationSchema,
  carRentalReservationSchema,
  activityReservationSchema,
  meetingReservationSchema,
]);

export const reservationExtractSchema = z.object({
  reservations: z.array(reservationItemSchema),
});

export type ReservationExtract = z.output<typeof reservationExtractSchema>;
export type FlightReservation = z.output<typeof flightReservationSchema>;
export type HotelReservation = z.output<typeof hotelReservationSchema>;
export type TrainReservation = z.output<typeof trainReservationSchema>;
export type ExtractedReservation = z.output<typeof reservationItemSchema>;

const MAX_BODY_CHARS = 20_000;

function toPlainText(body: string): string {
  let text = body;
  if (/<\/?[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

const SYSTEM_PROMPT = [
  "You extract travel and booking confirmations from emails.",
  "Supported types: flight, hotel, train, restaurant, car_rental, activity, meeting.",
  "Confirmation emails vary widely in format — extract whatever fields are explicitly present.",
  "Only extract information explicitly present in the email. Never guess or invent values.",
  "If a field is not present, use null. If the email contains no booking confirmation, return an empty reservations array.",
  "Emails with multiple legs or bookings must produce one entry per booking/leg.",
  "Dates and times must be ISO 8601 local times without a timezone offset: YYYY-MM-DDTHH:mm (or YYYY-MM-DD if no time).",
  "Airports should be IATA codes when stated (e.g. SFO), otherwise the name as written.",
  "Output JSON shaped as:",
  '{"reservations":[',
  '{"type":"flight","confirmationNumber":string|null,"airline":string|null,"flightNumber":string|null,"departureAirport":string,"arrivalAirport":string,"departureTime":string,"arrivalTime":string|null,"passengerNames":string[]|null},',
  '{"type":"hotel","confirmationNumber":string|null,"hotelName":string,"address":string|null,"checkIn":string,"checkOut":string,"guestNames":string[]|null},',
  '{"type":"train","confirmationNumber":string|null,"operator":string|null,"trainNumber":string|null,"departureStation":string,"arrivalStation":string,"departureTime":string,"arrivalTime":string|null,"passengerNames":string[]|null},',
  '{"type":"restaurant","confirmationNumber":string|null,"restaurantName":string,"address":string|null,"reservationTime":string|null,"partySize":number|null,"guestNames":string[]|null},',
  '{"type":"car_rental","confirmationNumber":string|null,"provider":string|null,"pickupLocation":string,"dropoffLocation":string|null,"pickupTime":string,"dropoffTime":string|null,"guestNames":string[]|null},',
  '{"type":"activity","confirmationNumber":string|null,"title":string,"location":string|null,"startTime":string|null,"endTime":string|null,"guestNames":string[]|null},',
  '{"type":"meeting","confirmationNumber":string|null,"title":string,"location":string|null,"startTime":string|null,"endTime":string|null,"guestNames":string[]|null}',
  "]}",
].join("\n");

/**
 * Extract reservations from a booking email. Supports varied confirmation formats
 * (airline, hotel, restaurant, car rental, activity, meeting, etc.).
 */
export async function extractReservationFromEmail(
  body: string,
  subject?: string | null,
  options: { signal?: AbortSignal } = {},
): Promise<ReservationExtract> {
  const text = toPlainText(body);
  if (!text) return { reservations: [] };

  const header = subject?.trim() ? `Subject: ${subject.trim()}\n\n` : "";
  return chatJson({
    system: SYSTEM_PROMPT,
    user: `Email content:\n"""\n${header}${text}\n"""`,
    schema: reservationExtractSchema,
    temperature: 0,
    signal: options.signal,
  });
}
