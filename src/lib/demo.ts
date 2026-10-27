import { cookies } from "next/headers";
import {
  DEMO_COOKIE,
  DEMO_TRIP_ID,
  DEMO_USER_ID,
  isDemoModeEnabled,
} from "@/lib/demo-config";
import type {
  ItineraryItem,
  Profile,
  Trip,
  UserPreferences,
} from "@/types/database";

export {
  DEMO_COOKIE,
  DEMO_TRIP_ID,
  DEMO_USER_ID,
  getDemoPassword,
  isDemoModeEnabled,
} from "@/lib/demo-config";

export function demoProfile(): Profile {
  return {
    id: DEMO_USER_ID,
    username: "preview",
    display_name: "Preview Traveler",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function demoPreferences(): UserPreferences {
  return {
    user_id: DEMO_USER_ID,
    preferred_transport_modes: ["walking", "transit"],
    travel_pace: "moderate",
    interests: ["museums", "coffee", "architecture"],
    distance_unit: "km",
    timezone_display: "destination",
    auto_confirm_imports: false,
    award_check_enabled: true,
    award_check_timezone: "America/Los_Angeles",
    award_check_start_minute: 1080,
    award_check_end_minute: 1260,
    award_approve_to_book: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function demoTrips(): Trip[] {
  return [
    {
      id: DEMO_TRIP_ID,
      owner_id: DEMO_USER_ID,
      name: "Paris client week",
      destination_name: "Paris, France",
      destination_latitude: 48.8566,
      destination_longitude: 2.3522,
      destination_image_url: null,
      destination_image_attribution: null,
      start_date: "2026-11-10",
      end_date: "2026-11-14",
      timezone: "Europe/Paris",
      status: "planned",
      email_slug: "parisclientweek",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

export function demoItineraryItems(): ItineraryItem[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000101",
      trip_id: DEMO_TRIP_ID,
      created_by: DEMO_USER_ID,
      item_type: "place",
      title: "Louvre Museum",
      description: "Sample preview stop — not saved to a database.",
      location_name: "Louvre Museum",
      address: "Rue de Rivoli, 75001 Paris, France",
      latitude: 48.8606,
      longitude: 2.3376,
      start_at: "2026-11-11T10:00:00+01:00",
      end_at: "2026-11-11T13:00:00+01:00",
      timezone: "Europe/Paris",
      sort_order: 1,
      booking_reference: null,
      source_url: null,
      thumbnail_url: null,
      details: { preview: true },
      osm_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      trip_id: DEMO_TRIP_ID,
      created_by: DEMO_USER_ID,
      item_type: "place",
      title: "Café de Flore",
      description: "Sample café stop for the preview map and timeline.",
      location_name: "Café de Flore",
      address: "172 Boulevard Saint-Germain, 75006 Paris, France",
      latitude: 48.8541,
      longitude: 2.3324,
      start_at: "2026-11-11T14:00:00+01:00",
      end_at: null,
      timezone: "Europe/Paris",
      sort_order: 2,
      booking_reference: null,
      source_url: null,
      thumbnail_url: null,
      details: { preview: true },
      osm_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

export async function hasDemoSession(): Promise<boolean> {
  if (!isDemoModeEnabled()) return false;
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}
