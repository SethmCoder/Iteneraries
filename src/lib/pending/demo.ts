import { DEMO_TRIP_ID, DEMO_USER_ID } from "@/lib/demo-config";
import type { PendingFlight, PendingHotel } from "@/types/database";

export function demoPendingFlights(): PendingFlight[] {
  const now = new Date().toISOString();
  return [
    {
      id: "00000000-0000-4000-8000-000000000301",
      user_id: DEMO_USER_ID,
      trip_id: DEMO_TRIP_ID,
      origin: "SFO",
      destination: "CDG",
      depart_date: "2026-11-09",
      return_date: "2026-11-16",
      passengers: 1,
      airline: "UA",
      booking_status: "needs_booking",
      booking_url: null,
      notes: "Prefer morning departure",
      created_at: now,
      updated_at: now,
    },
  ];
}

export function demoPendingHotels(): PendingHotel[] {
  const now = new Date().toISOString();
  return [
    {
      id: "00000000-0000-4000-8000-000000000302",
      user_id: DEMO_USER_ID,
      trip_id: DEMO_TRIP_ID,
      hotel_name: "Hotel example near Louvre",
      location: "Paris, France",
      check_in: "2026-11-10",
      check_out: "2026-11-15",
      rooms: 1,
      guests: 1,
      booking_status: "in_progress",
      booking_url: null,
      notes: null,
      created_at: now,
      updated_at: now,
    },
  ];
}
