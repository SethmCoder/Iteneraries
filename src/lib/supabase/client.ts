"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured as isConfiguredFromEnv,
  type SupabasePublicConfig,
} from "@/lib/supabase/config";

export function createClient(config?: SupabasePublicConfig | null) {
  const fromProps = config?.url && config?.anonKey ? config : null;
  const fromEnv = getSupabasePublicConfig();
  const resolved = fromProps ?? fromEnv;
  if (!resolved) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createBrowserClient(resolved.url, resolved.anonKey);
}

export function isSupabaseConfigured(): boolean {
  return isConfiguredFromEnv();
}
