import type { AwardSearch, LoyaltyBalance } from "@/types/database";
import { DEMO_USER_ID } from "@/lib/demo-config";

export function demoLoyaltyBalances(): LoyaltyBalance[] {
  const now = new Date().toISOString();
  return [
    {
      id: "00000000-0000-4000-8000-000000000201",
      user_id: DEMO_USER_ID,
      program: "united",
      balance: 84000,
      currency_label: "miles",
      source: "manual",
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      user_id: DEMO_USER_ID,
      program: "aeroplan",
      balance: 62000,
      currency_label: "points",
      source: "manual",
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    },
  ];
}

export function demoAwardSearches(): AwardSearch[] {
  const now = new Date().toISOString();
  return [
    {
      id: "00000000-0000-4000-8000-000000000210",
      user_id: DEMO_USER_ID,
      trip_id: null,
      origin: "SFO",
      destination: "NRT",
      trip_type: "round_trip",
      depart_date: "2026-11-10",
      depart_date_end: "2026-11-14",
      return_date: "2026-11-20",
      return_date_end: "2026-11-24",
      passengers: 1,
      cabin: "business",
      max_points_per_passenger: 90000,
      max_points_total: 90000,
      max_cash_fees: 200,
      preferred_program: "united",
      status: "setup_required",
      notify_on_match: true,
      require_booking_approval: true,
      poll_interval_minutes: 360,
      last_checked_at: null,
      last_notified_fingerprint: null,
      paused_at: null,
      preferences: {
        maxConnections: 1,
        nearbyAirportsOk: true,
        mixedCabinOk: false,
        separateTicketsOk: false,
      },
      created_at: now,
      updated_at: now,
    },
  ];
}
