import { z } from "zod";

export const awardSearchFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    tripId: z.string().uuid().nullable().optional(),
    origin: z
      .string()
      .trim()
      .min(3, "Origin airport or city is required")
      .max(64),
    destination: z
      .string()
      .trim()
      .min(3, "Destination airport or city is required")
      .max(64),
    tripType: z.enum(["one_way", "round_trip"]),
    departDate: z.string().nullable().optional(),
    departDateEnd: z.string().nullable().optional(),
    returnDate: z.string().nullable().optional(),
    returnDateEnd: z.string().nullable().optional(),
    passengers: z.number().int().min(1).max(9),
    cabin: z.enum(["economy", "premium_economy", "business", "first"]),
    maxPointsPerPassenger: z.number().int().positive().nullable().optional(),
    maxPointsTotal: z.number().int().positive().nullable().optional(),
    maxCashFees: z.number().nonnegative().nullable().optional(),
    preferredProgram: z.string().nullable().optional(),
    programs: z.array(z.string()).default([]),
    notifyOnMatch: z.boolean().default(true),
    requireBookingApproval: z.boolean().default(true),
    pollIntervalMinutes: z.number().int().min(60).max(10080).default(360),
    preferences: z
      .object({
        departTimeStart: z.string().nullable().optional(),
        departTimeEnd: z.string().nullable().optional(),
        arriveTimeStart: z.string().nullable().optional(),
        arriveTimeEnd: z.string().nullable().optional(),
        maxConnections: z.number().int().min(0).max(4).nullable().optional(),
        preferredAirlines: z.array(z.string()).optional(),
        preferredAlliances: z.array(z.string()).optional(),
        maxLayoverMinutes: z.number().int().positive().nullable().optional(),
        nearbyAirportsOk: z.boolean().optional(),
        mixedCabinOk: z.boolean().optional(),
        separateTicketsOk: z.boolean().optional(),
      })
      .default({}),
  })
  .superRefine((data, ctx) => {
    if (!data.departDate && !data.departDateEnd) {
      ctx.addIssue({
        code: "custom",
        message: "Add a departure date or flexible date range",
        path: ["departDate"],
      });
    }
    if (
      data.departDate &&
      data.departDateEnd &&
      data.departDateEnd < data.departDate
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Flexible end date cannot be before start date",
        path: ["departDateEnd"],
      });
    }
    if (data.tripType === "round_trip" && !data.returnDate && !data.returnDateEnd) {
      ctx.addIssue({
        code: "custom",
        message: "Round-trip searches need a return date or range",
        path: ["returnDate"],
      });
    }
    if (
      data.origin.trim().toUpperCase() === data.destination.trim().toUpperCase()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Origin and destination must differ",
        path: ["destination"],
      });
    }
  });

export type AwardSearchFormInput = z.infer<typeof awardSearchFormSchema>;

export const loyaltyBalanceSchema = z.object({
  id: z.string().uuid().optional(),
  program: z.string().trim().min(2).max(64),
  balance: z.number().int().min(0),
  currencyLabel: z.string().trim().min(1).max(32).default("points"),
});
