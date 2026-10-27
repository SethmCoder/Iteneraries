import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import {
  getInboundEmailAddress,
  isAiConfigured,
  isEmailImportConfigured,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
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
        (trips ?? []).map((t) => {
          const trip = Array.isArray(t.trips) ? t.trips[0] : t.trips;
          return trip as { id: string; name: string | null; destination_name: string | null };
        }).filter(Boolean)
      }
      emailImport={{
        configured: isEmailImportConfigured(),
        address: personalAddress,
        aiConfigured: isAiConfigured(),
      }}
    />
  );
}
