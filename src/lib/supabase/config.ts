/**
 * Server-safe Supabase public config.
 * Rejects empty values and .env.example placeholders.
 */

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

function readPublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anonKey) return null;
  if (url.includes("your-project") || anonKey === "your-anon-key") return null;
  return { url, anonKey };
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return readPublicConfig();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readPublicConfig());
}
