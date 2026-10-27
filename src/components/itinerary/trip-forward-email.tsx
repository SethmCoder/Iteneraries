"use client";

import { useState } from "react";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TripForwardEmail({
  address,
  configured,
  tripName,
}: {
  address: string | null;
  configured: boolean;
  tripName: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Mail className="h-4 w-4 text-brand" />
            Forward reservations to this trip
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Forward airline or hotel confirmations to the address below. The{" "}
            <code className="text-[11px]">+</code> tag routes mail into{" "}
            {tripName?.trim() || "this trip"}.
          </p>
        </div>
        {configured && address ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-[8px] bg-brand-light px-2 py-1 text-xs text-brand">
              {address}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-warning">
            Set INBOUND_EMAIL_ADDRESS (and Resend webhook) to enable trip forward
            addresses like planner+parisclientweek@yourdomain.com.
          </p>
        )}
      </div>
    </div>
  );
}
