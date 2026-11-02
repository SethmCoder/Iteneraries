/**
 * Resolve which Waypoint account owns an inbound confirmation email.
 * Handles "Name <email>", Reply-To, and Gmail/Outlook forwarded blocks.
 */

const EMAIL_RE =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

/** Pull a bare email from `Name <a@b.com>` or a raw address. */
export function parseEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = /<([^>]+)>/.exec(trimmed);
  const candidate = (angle?.[1] ?? trimmed).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null;
  return candidate;
}

function uniqueEmails(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const e = parseEmailAddress(v) ?? (v?.includes("@") ? v.trim().toLowerCase() : null);
    if (!e || seen.has(e)) continue;
    // Skip obvious noreply / vendor system addresses when we already have others
    seen.add(e);
    out.push(e);
  }
  return out;
}

/**
 * Collect owner-identity candidates from envelope + body.
 * Prefer human forwarder addresses over airline noreply when both exist.
 */
export function extractOwnerEmailCandidates(input: {
  from?: string | null;
  replyTo?: string | null | string[];
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): string[] {
  const replyList = Array.isArray(input.replyTo)
    ? input.replyTo
    : input.replyTo
      ? [input.replyTo]
      : [];

  const headerCandidates = [
    ...replyList.map((r) => parseEmailAddress(r)),
    parseEmailAddress(input.from),
  ];

  const body = `${input.subject ?? ""}\n${input.text ?? ""}\n${stripHtml(input.html ?? "")}`;
  const forwarded = extractForwardedFromAddresses(body);

  const ranked = uniqueEmails([
    ...headerCandidates,
    ...forwarded,
    ...Array.from(body.matchAll(EMAIL_RE)).map((m) => m[0]!.toLowerCase()),
  ]);

  // Prefer non-noreply addresses first (forwarder / traveler)
  return ranked.sort((a, b) => scoreOwnerLikeness(b) - scoreOwnerLikeness(a));
}

function scoreOwnerLikeness(email: string): number {
  const local = email.split("@")[0] ?? "";
  let score = 0;
  if (!/(no[-_]?reply|donotreply|do-not-reply|mailer-daemon|notifications?|booking|confirm)/i.test(local)) {
    score += 20;
  }
  if (/(gmail|googlemail|outlook|hotmail|icloud|yahoo|me\.com|proton)/i.test(email)) {
    score += 10;
  }
  if (/(united|delta|aa\.com|alaska|hilton|marriott|hyatt|booking\.com|expedia)/i.test(email)) {
    score -= 15;
  }
  return score;
}

/** Parse classic “Forwarded message” / Outlook FW headers for original From. */
export function extractForwardedFromAddresses(body: string): string[] {
  const found: string[] = [];
  const patterns = [
    /^-{2,}\s*Forwarded message\s*-{2,}[\s\S]{0,400}?^From:\s*(.+)$/gim,
    /^Begin forwarded message:[\s\S]{0,400}?^From:\s*(.+)$/gim,
    /^From:\s*(.+)$/gim,
    /^---------- Forwarded message ---------[\s\S]{0,400}?^From:\s*(.+)$/gim,
  ];
  for (const re of patterns) {
    for (const match of body.matchAll(re)) {
      const parsed = parseEmailAddress(match[1]);
      if (parsed) found.push(parsed);
    }
  }
  return uniqueEmails(found);
}

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
}

export type AuthUserEmailRow = {
  id: string;
  email?: string | null;
};

/**
 * Match candidate emails to a Supabase Auth user (case-insensitive).
 * Scans all pages of listUsers when a pager is provided.
 */
export async function resolveUserIdByEmails(
  candidates: string[],
  listPage: (page: number) => Promise<{ users: AuthUserEmailRow[]; nextPage?: number | null }>,
): Promise<{ userId: string; matchedEmail: string } | null> {
  if (candidates.length === 0) return null;
  const wanted = new Set(candidates.map((c) => c.toLowerCase()));

  let page = 1;
  for (let i = 0; i < 20; i++) {
    const { users, nextPage } = await listPage(page);
    for (const u of users) {
      const email = u.email?.toLowerCase();
      if (email && wanted.has(email)) {
        return { userId: u.id, matchedEmail: email };
      }
    }
    if (!nextPage) break;
    page = nextPage;
  }
  return null;
}
