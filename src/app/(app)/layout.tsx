import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import {
  demoProfile,
  demoTrips,
  hasDemoSession,
  isDemoModeEnabled,
} from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Trip } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isDemoModeEnabled() && (await hasDemoSession())) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--page-bg)]">
        <div className="bg-warning/10 px-4 py-2 text-center text-xs font-medium text-warning">
          Preview mode — UI only. Changes are not saved until Supabase is connected.
        </div>
        <AppHeader profile={demoProfile()} nextTrip={demoTrips()[0] ?? null} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 md:px-6">
          {children}
        </main>
      </div>
    );
  }

  let profile: Profile | null = null;
  let nextTrip: Trip | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    profile = profileData ?? {
      id: user.id,
      username: user.email?.split("@")[0] ?? "user",
      display_name: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const today = new Date().toISOString().slice(0, 10);
    const { data: trips } = await supabase
      .from("trips")
      .select("*")
      .or(`start_date.gte.${today},start_date.is.null`)
      .order("start_date", { ascending: true, nullsFirst: false })
      .limit(1);

    nextTrip = trips?.[0] ?? null;
  } catch {
    redirect("/login");
  }

  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--page-bg)]">
      <AppHeader profile={profile} nextTrip={nextTrip} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 md:px-6">
        {children}
      </main>
    </div>
  );
}
