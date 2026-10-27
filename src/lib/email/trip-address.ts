/** Build plus-addressed inbound email for a trip slug. */
export function buildTripForwardAddress(
  inboundEmail: string | null | undefined,
  emailSlug: string | null | undefined,
): string | null {
  if (!inboundEmail || !emailSlug) return null;
  const at = inboundEmail.indexOf("@");
  if (at < 1) return null;
  const local = inboundEmail.slice(0, at);
  const domain = inboundEmail.slice(at + 1);
  if (!local || !domain) return null;
  return `${local}+${emailSlug}@${domain}`;
}

/** Extract the plus-tag from recipient addresses (planner+parisclientweek@…). */
export function extractPlusTagFromRecipients(recipients: string[]): string | null {
  const joined = recipients.join(" ");
  const match = joined.match(/\+([a-z0-9][a-z0-9_-]{1,63})@/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function slugifyTripName(
  name: string | null | undefined,
  fallbackId: string,
): string {
  const raw = (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
  if (raw.length >= 3) return raw;
  const short = fallbackId.replace(/-/g, "").slice(0, 8);
  return `trip${short}`;
}

export async function allocateUniqueTripSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (t: string) => any },
  desired: string,
  excludeTripId?: string,
): Promise<string> {
  let candidate = desired.slice(0, 40) || "trip";
  if (candidate.length < 3) candidate = `trip${candidate}`;
  for (let n = 0; n < 50; n++) {
    const trySlug = n === 0 ? candidate : `${candidate.slice(0, 32)}${n}`;
    let q = supabase
      .from("trips")
      .select("id")
      .eq("email_slug", trySlug)
      .limit(1);
    if (excludeTripId) q = q.neq("id", excludeTripId);
    const { data } = await q.maybeSingle();
    if (!data) return trySlug;
  }
  return `${candidate.slice(0, 24)}${Date.now().toString(36)}`;
}
