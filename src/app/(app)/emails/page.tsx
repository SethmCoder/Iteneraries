import { ForwardedEmailsWorkspace } from "@/components/emails/forwarded-emails-workspace";
import { hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Forwarded Emails" };

export default async function EmailsPage() {
  if (isDemoModeEnabled() && (await hasDemoSession())) {
    return <ForwardedEmailsWorkspace emails={[]} trips={[]} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: emails } = await supabase
    .from("imported_emails")
    .select(
      "id, subject, from_address, status, raw_text, raw_html, ai_summary, created_at, reservation_reviews(id, trip_id, status, match_reason, matched_trip_confidence, extracted_data)",
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("trip_id, trips:trip_id(id, name, destination_name)")
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const trips = (memberRows ?? [])
    .map((row) => {
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      return trip as {
        id: string;
        name: string | null;
        destination_name: string | null;
      } | null;
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string | null;
    destination_name: string | null;
  }>;

  const normalized = (emails ?? []).map((e) => {
    const reviews = e.reservation_reviews as
      | Array<{
          id: string;
          trip_id: string | null;
          status: string;
          match_reason: string | null;
          matched_trip_confidence: number | null;
          extracted_data: Record<string, unknown>;
        }>
      | {
          id: string;
          trip_id: string | null;
          status: string;
          match_reason: string | null;
          matched_trip_confidence: number | null;
          extracted_data: Record<string, unknown>;
        }
      | null;
    const review = Array.isArray(reviews) ? reviews[0] ?? null : reviews;
    return {
      id: e.id as string,
      subject: e.subject as string | null,
      from_address: e.from_address as string | null,
      status: e.status as string,
      raw_text: (e.raw_text as string | null) ?? null,
      raw_html: (e.raw_html as string | null) ?? null,
      ai_summary: (e.ai_summary as string | null) ?? null,
      created_at: e.created_at as string,
      review,
    };
  });

  return <ForwardedEmailsWorkspace emails={normalized} trips={trips} />;
}
