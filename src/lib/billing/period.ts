import {
  ACCOUNT_DELETE_GRACE_DAYS,
  ACCOUNT_PERIOD_DAYS,
} from "@/lib/billing/constants";

export function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Extend from the later of now or current period end (no lost days on early renew). */
export function nextPeriodEnd(currentPeriodEnd: string | Date, now = new Date()): Date {
  const end = new Date(currentPeriodEnd);
  const base = end.getTime() > now.getTime() ? end : now;
  return addDays(base, ACCOUNT_PERIOD_DAYS);
}

export function deleteAfterFromPeriodEnd(periodEnd: Date): Date {
  return addDays(periodEnd, ACCOUNT_DELETE_GRACE_DAYS);
}

export function daysUntil(iso: string | Date, now = new Date()): number {
  const end = new Date(iso).getTime();
  return Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function isAccessAllowed(status: string, periodEnd: string, now = new Date()): boolean {
  if (status === "expired" || status === "canceled") return false;
  return new Date(periodEnd).getTime() > now.getTime();
}

/** Shared helper for Stripe webhooks (later) or admin renew paths. */
export function buildPeriodExtension(currentPeriodEnd: string, now = new Date()) {
  const periodEnd = nextPeriodEnd(currentPeriodEnd, now);
  return {
    current_period_end: periodEnd.toISOString(),
    delete_after: deleteAfterFromPeriodEnd(periodEnd).toISOString(),
    status: "active" as const,
    last_renewed_at: now.toISOString(),
    reminder_stage: "none" as const,
  };
}
