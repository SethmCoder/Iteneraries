import { z } from "zod";

export const bookingStatusSchema = z.enum([
  "needs_booking",
  "in_progress",
  "booked",
  "skipped",
]);

export const pendingFlightSchema = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid(),
  origin: z.string().trim().min(3).max(3),
  destination: z.string().trim().min(3).max(3),
  departDate: z.string().nullable().optional(),
  returnDate: z.string().nullable().optional(),
  passengers: z.number().int().min(1).max(9),
  airline: z.string().trim().max(8).nullable().optional(),
  bookingStatus: bookingStatusSchema,
  bookingUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const pendingHotelSchema = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid(),
  hotelName: z.string().trim().min(1).max(200),
  location: z.string().trim().max(300).nullable().optional(),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  rooms: z.number().int().min(1).max(20),
  guests: z.number().int().min(1).max(30),
  bookingStatus: bookingStatusSchema,
  bookingUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});
