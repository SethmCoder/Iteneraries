import { z } from "zod";

export const constraintKindSchema = z.enum(["fixed", "flexible", "preferred"]);

export const planningScenarioSchema = z.enum([
  "destination_and_dates",
  "destination_flexible_dates",
  "dates_flexible_destination",
  "both_flexible",
  "fixed_event",
]);

export const planningProfileSchema = z.object({
  scenario: planningScenarioSchema.optional(),
  originAirports: z.array(z.string().trim().min(3).max(3)).max(8).optional(),
  destinations: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  dateFlexibility: constraintKindSchema.optional(),
  destinationFlexibility: constraintKindSchema.optional(),
  travelers: z.number().int().min(1).max(20).optional(),
  budgetNote: z.string().max(500).optional(),
  purpose: z.string().max(200).optional(),
  mustDos: z.array(z.string().max(200)).max(20).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  cashVsPoints: z.enum(["cash", "points", "either"]).optional(),
  fixedEvent: z
    .object({
      title: z.string().max(200),
      date: z.string().optional(),
      location: z.string().max(200).optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
});

export type PlanningProfile = z.infer<typeof planningProfileSchema>;
export type PlanningScenario = z.infer<typeof planningScenarioSchema>;
