import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import {
  demoPreferences,
  demoProfile,
  demoTrips,
  hasDemoSession,
  isDemoModeEnabled,
} from "@/lib/demo";
import {
  getInboundEmailAddress,
  isAiConfigured,
  isEmailImportConfigured,
  isOutboundEmailConfigured,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AccountBilling } from "@/types/database";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab = params.tab ?? null;

  if (isDemoModeEnabled() && (await hasDemoSession())) {
    const trips = demoTrips().map((t) => ({
      id: t.id,
      name: t.name,
      destination_name: t.destination_name,
    }));
    return (
      <SettingsWorkspace
        email="preview@example.com"
        profile={demoProfile()}
        preferences={demoPreferences()}
        pendingReviews={[]}
        trips={trips}
        emailImport={{
          configured: false,
          address: null,
          aiConfigured: false,
        }}
        billing={null}
        outboundEmailConfigured={false}
        initialTab={initialTab}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: alias } = await supabase
    .from("email_aliases")
    .select("alias_token")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: reviews } = await supabase
    .from("reservation_reviews")
    .select("*, imported_emails(subject, from_address, status)")
    .eq("user_id", user!.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: trips } = await supabase
    .from("trip_members")
    .select("trip_id, trips:trip_id(id, name, destination_name)")
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const { data: billing } = await supabase
    .from("account_billing")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  const inbound = getInboundEmailAddress();
  const personalAddress =
    inbound && alias?.alias_token
      ? inbound.replace("@", `+${alias.alias_token}@`)
      : inbound;

  return (
    <SettingsWorkspace
      email={user!.email ?? ""}
      profile={profile!}
      preferences={preferences}
      pendingReviews={(reviews ?? []) as never[]}
      trips={
        (trips ?? [])
          .map((t) => {
            const trip = Array.isArray(t.trips) ? t.trips[0] : t.trips;
            return trip as {
              id: string;
              name: string | null;
              destination_name: string | null;
            };
          })
          .filter(Boolean)
      }
      emailImport={{
        configured: isEmailImportConfigured(),
        address: personalAddress,
        aiConfigured: isAiConfigured(),
      }}
      billing={(billing as AccountBilling | null) ?? null}
      outboundEmailConfigured={isOutboundEmailConfigured()}
      initialTab={initialTab}
    />
  );
}
