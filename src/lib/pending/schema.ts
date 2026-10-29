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
  flightNumber: z.string().trim().max(16).nullable().optional(),
  bookingStatus: bookingStatusSchema,
  bookingUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const pendingHotelSchema = z
  .object({
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
  })
  .superRefine((val, ctx) => {
    if (val.checkIn && val.checkOut && val.checkOut <= val.checkIn) {
      ctx.addIssue({
        code: "custom",
        message: "Check-out must be after check-in",
        path: ["checkOut"],
      });
    }
  });

export const pendingCarSchema = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid(),
  provider: z.string().trim().max(120).nullable().optional(),
  pickupLocation: z.string().trim().max(300).nullable().optional(),
  dropoffLocation: z.string().trim().max(300).nullable().optional(),
  pickupAt: z.string().nullable().optional(),
  dropoffAt: z.string().nullable().optional(),
  bookingStatus: bookingStatusSchema,
  bookingUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  confirmationNumber: z.string().trim().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const pendingActivitySchema = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  activityType: z.enum([
    "restaurant",
    "meeting",
    "transportation",
    "attraction",
    "hotel",
    "flight",
    "other",
  ]),
  location: z.string().trim().max(300).nullable().optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  bookingStatus: bookingStatusSchema,
  bookingUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  confirmationNumber: z.string().trim().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
