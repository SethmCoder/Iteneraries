export const DEMO_COOKIE = "waypoint_demo";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_TRIP_ID = "00000000-0000-4000-8000-000000000010";

/** Set NEXT_PUBLIC_DEMO_MODE=true to enable preview login without Supabase. */
export function isDemoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** Optional password for the preview login. If unset, any password works in demo mode. */
export function getDemoPassword(): string | null {
  return process.env.DEMO_PASSWORD?.trim() || null;
}
