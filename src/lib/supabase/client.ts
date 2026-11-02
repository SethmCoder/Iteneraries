"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured as isConfiguredFromEnv } from "@/lib/supabase/config";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || url.includes("your-project") || key === "your-anon-key") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured(): boolean {
  return isConfiguredFromEnv();
}
