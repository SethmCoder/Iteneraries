"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { daysUntil, isAccessAllowed } from "@/lib/billing/period";
import type { AccountBilling } from "@/types/database";

export function AccountAccessGate({
  billing,
}: {
  billing: AccountBilling | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const accessOk =
    !billing || isAccessAllowed(billing.status, billing.current_period_end);
  const onSettings = pathname.startsWith("/settings");
  const daysLeft = billing ? daysUntil(billing.current_period_end) : null;
  const showRenewBanner =
    Boolean(billing && accessOk && daysLeft != null && daysLeft <= 7);

  useEffect(() => {
    if (!accessOk && !onSettings) {
      router.replace("/settings?tab=account");
    }
  }, [accessOk, onSettings, router]);

  if (!accessOk) {
    return (
      <div className="bg-destructive/10 px-4 py-2 text-center text-xs font-medium text-destructive">
        Your access period has expired.{" "}
        <Link href="/settings?tab=account" className="underline">
          Renew in Settings
        </Link>{" "}
        to restore access before your account is deleted.
      </div>
    );
  }

  if (showRenewBanner) {
    return (
      <div className="bg-warning/10 px-4 py-2 text-center text-xs font-medium text-warning">
        Access ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}.{" "}
        <Link href="/settings?tab=account" className="underline">
          Renew for 30 days
        </Link>
      </div>
    );
  }

  return null;
}
