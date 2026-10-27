import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { verifyApproveToken } from "@/lib/flights/approve-token";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Approve booking" };

export default async function ApproveBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    searchId?: string;
    fingerprint?: string;
    token?: string;
  }>;
}) {
  const params = await searchParams;
  const searchId = params.searchId?.trim() ?? "";
  const fingerprint = params.fingerprint?.trim() ?? "";
  const token = params.token?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/flights/approve?searchId=${searchId}&fingerprint=${fingerprint}&token=${token}`,
      )}`,
    );
  }

  if (!searchId || !fingerprint || !token) {
    return (
      <ApproveShell
        title="Missing approve link"
        body="This approve link is incomplete. Open the match from Flight Booker instead."
      />
    );
  }

  const verified = verifyApproveToken(token, {
    userId: user.id,
    searchId,
    fingerprint,
  });
  if (!verified.ok) {
    return <ApproveShell title="Cannot approve" body={verified.error} />;
  }

  const { data: search } = await supabase
    .from("award_searches")
    .select("id, origin, destination, require_booking_approval, user_id")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!search) {
    return (
      <ApproveShell
        title="Search not found"
        body="That award search is missing or belongs to another account."
      />
    );
  }

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("award_approve_to_book")
    .eq("user_id", user.id)
    .maybeSingle();

  const approveRequired =
    prefs?.award_approve_to_book !== false || search.require_booking_approval;
  if (!approveRequired) {
    // Preference turned off — still allow handoff for this signed link.
  }

  const { data: result } = await supabase
    .from("award_results")
    .select("id, booking_url, points_per_passenger, airline, depart_at")
    .eq("search_id", searchId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (!result) {
    return (
      <ApproveShell
        title="No longer available"
        body="We couldn't find that award result anymore — it may have disappeared. Check Flight Booker for current options."
      />
    );
  }

  if (!result.booking_url) {
    return (
      <ApproveShell
        title="No booking link"
        body="This match has no airline booking URL. Open Flight Booker to review alternatives."
      />
    );
  }

  await supabase
    .from("award_results")
    .update({ user_approved_at: new Date().toISOString() })
    .eq("id", result.id);

  redirect(result.booking_url);
}

function ApproveShell({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">{body}</p>
      <p className="text-xs text-muted">
        Approve opens the airline site only after you confirm. Waypoint never
        redeems miles for you.
      </p>
      <Button asChild>
        <Link href="/flights">Open Flight Booker</Link>
      </Button>
    </div>
  );
}
