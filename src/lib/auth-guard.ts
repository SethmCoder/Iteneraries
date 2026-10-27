import { cookies } from "next/headers";
import { DEMO_COOKIE, isDemoModeEnabled } from "@/lib/demo-config";
import { createClient } from "@/lib/supabase/server";

/** Returns a stable user id for rate limiting, or null if unauthenticated. */
export async function getRequestUserId(): Promise<string | null> {
  if (isDemoModeEnabled()) {
    const store = await cookies();
    if (store.get(DEMO_COOKIE)?.value === "1") {
      return "demo-preview";
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
