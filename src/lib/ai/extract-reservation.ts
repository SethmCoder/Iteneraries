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

export const reservationItemSchema = z.discriminatedUnion("type", [
  flightReservationSchema,
  hotelReservationSchema,
  trainReservationSchema,
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
  "You extract travel reservations (flights, hotels, trains) from booking confirmation emails.",
  "Only extract information explicitly present in the email. Never guess or invent values.",
  "If a field is not present, use null. If the email contains no flight, hotel, or train reservation, return an empty reservations array.",
  "Emails with multiple flight or train legs must produce one entry per leg.",
  "Dates and times must be ISO 8601 local times at the location without a timezone offset: YYYY-MM-DDTHH:mm (use YYYY-MM-DD only if no time is given for a hotel).",
  "Airports should be IATA codes when stated (e.g. SFO), otherwise the name as written.",
  "Output JSON shaped as:",
  '{"reservations":[',
  '{"type":"flight","confirmationNumber":string|null,"airline":string|null,"flightNumber":string|null,"departureAirport":string,"arrivalAirport":string,"departureTime":string,"arrivalTime":string|null,"passengerNames":string[]|null},',
  '{"type":"hotel","confirmationNumber":string|null,"hotelName":string,"address":string|null,"checkIn":string,"checkOut":string,"guestNames":string[]|null},',
  '{"type":"train","confirmationNumber":string|null,"operator":string|null,"trainNumber":string|null,"departureStation":string,"arrivalStation":string,"departureTime":string,"arrivalTime":string|null,"passengerNames":string[]|null}',
  "]}",
].join("\n");

/**
 * Extract reservations from a booking email. `subject` (optional) is provided to
 * the model as extra context. Returns an empty `reservations` array when the
 * email contains no flight, hotel, or train booking.
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
