export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isEmailImportConfigured(): boolean {
  return Boolean(
    process.env.RESEND_WEBHOOK_SECRET && process.env.INBOUND_EMAIL_ADDRESS,
  );
}

export function getInboundEmailAddress(): string | null {
  return process.env.INBOUND_EMAIL_ADDRESS ?? null;
}

export function getOverpassUrl(): string {
  return (
    process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter"
  );
}

/** Car / default OSRM host. Public project-osrm demo is driving-only. */
export function getOsrmBaseUrl(): string {
  return process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
}

/**
 * FOSSGIS multi-profile OSRM (Germany-hosted, public). Path prefixes select the
 * profile; the `/route/v1/{profile}/` segment still works with any name.
 * @see https://routing.openstreetmap.de/
 */
export function getOsrmWalkingBaseUrl(): string {
  return (
    process.env.OSRM_WALKING_BASE_URL ??
    "https://routing.openstreetmap.de/routed-foot"
  );
}

export function getOsrmBicycleBaseUrl(): string {
  return (
    process.env.OSRM_BICYCLE_BASE_URL ??
    "https://routing.openstreetmap.de/routed-bike"
  );
}

export function getTransitRouterUrl(): string | null {
  return process.env.TRANSIT_ROUTER_URL ?? null;
}

export function getNominatimBaseUrl(): string {
  return (
    process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org"
  );
}

export function getGeocoderUserAgent(): string {
  return (
    process.env.GEOCODER_USER_AGENT ??
    "WaypointTravelApp/1.0 (https://github.com/waypoint)"
  );
}

export type OpenAiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** Returns OpenAI-compatible provider config, or null when OPENAI_API_KEY is unset. */
export function getOpenAiConfig(): OpenAiConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/+$/,
      "",
    ),
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

export function getResendWebhookSecret(): string | null {
  return process.env.RESEND_WEBHOOK_SECRET ?? null;
}

export function isAwardSearchConfigured(): boolean {
  return Boolean(process.env.SEATS_AERO_API_KEY?.trim());
}

export function getSeatsAeroApiKey(): string | null {
  return process.env.SEATS_AERO_API_KEY?.trim() || null;
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}

export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

/** From-address for transactional mail (must be a verified Resend domain). */
export function getResendFromEmail(): string | null {
  return process.env.RESEND_FROM_EMAIL?.trim() || null;
}

export function isOutboundEmailConfigured(): boolean {
  return Boolean(getResendApiKey() && getResendFromEmail());
}
