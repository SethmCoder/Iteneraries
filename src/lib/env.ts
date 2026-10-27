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

export function getOsrmBaseUrl(): string {
  return process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
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
