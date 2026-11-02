/**
 * Server-safe Supabase public config check.
 * Rejects empty values and .env.example placeholders.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) return false;
  if (url.includes("your-project") || anon === "your-anon-key") return false;
  return true;
}
