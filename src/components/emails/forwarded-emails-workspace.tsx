"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import {
  assignEmailTripAction,
  confirmEmailImportFromInboxAction,
  summarizeImportedEmailAction,
} from "@/app/actions/emails";
import { rejectReservationImportAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TripOption = {
  id: string;
  name: string | null;
  destination_name: string | null;
};

type EmailRow = {
  id: string;
  subject: string | null;
  from_address: string | null;
  status: string;
  raw_text: string | null;
  raw_html: string | null;
  ai_summary: string | null;
  created_at: string;
  review: {
    id: string;
    trip_id: string | null;
    status: string;
    match_reason: string | null;
    matched_trip_confidence: number | null;
    extracted_data: Record<string, unknown>;
  } | null;
};

export function ForwardedEmailsWorkspace({
  emails,
  trips,
}: {
  emails: EmailRow[];
  trips: TripOption[];
}) {
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [tripQuery, setTripQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [assignTrip, setAssignTrip] = useState<Record<string, string>>({});

  const tripOptions = useMemo(() => {
    const q = tripQuery.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) =>
      `${t.name ?? ""} ${t.destination_name ?? ""}`.toLowerCase().includes(q),
    );
  }, [trips, tripQuery]);

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      if (tripFilter === "all") return true;
      if (tripFilter === "unassigned") return !e.review?.trip_id;
      return e.review?.trip_id === tripFilter;
    });
  }, [emails, tripFilter]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Forwarded Emails</h1>
        <p className="mt-1 text-sm text-muted">
          Raw confirmation emails by trip. Summarize without replacing the
          original. Confirm to add items to an itinerary.
        </p>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-[12px] border border-border bg-card p-4 shadow-sm">
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <label className="text-sm font-medium">Search trips</label>
          <Input
            value={tripQuery}
            onChange={(e) => setTripQuery(e.target.value)}
            placeholder="Filter trip list…"
          />
        </div>
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label className="text-sm font-medium">Show emails for</label>
          <select
            className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
            value={tripFilter}
            onChange={(e) => setTripFilter(e.target.value)}
          >
            <option value="all">All trips</option>
            <option value="unassigned">Unassigned</option>
            {tripOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.destination_name || "Untitled trip"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-card px-4 py-10 text-center">
          <Mail className="mx-auto h-8 w-8 text-brand/40" />
          <p className="mt-2 text-sm font-medium">No forwarded emails here</p>
          <p className="text-xs text-muted">
            Forward confirmations to your Waypoint inbound address.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((email) => {
            const open = expanded === email.id;
            const trip = trips.find((t) => t.id === email.review?.trip_id);
            const selectedAssign =
              assignTrip[email.id] || email.review?.trip_id || trips[0]?.id || "";
            return (
              <li
                key={email.id}
                className="rounded-[12px] border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-xs text-muted">
                      {email.from_address} ·{" "}
                      {new Date(email.created_at).toLocaleString()} ·{" "}
                      {email.status}
                      {trip
                        ? ` · ${trip.name || trip.destination_name}`
                        : " · Unassigned"}
                    </p>
                    {email.review?.match_reason ? (
                      <p className="mt-1 text-xs text-muted">
                        Match: {email.review.match_reason}
                        {email.review.matched_trip_confidence != null
                          ? ` (${Math.round(email.review.matched_trip_confidence * 100)}%)`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setExpanded(open ? null : email.id)}
                  >
                    {open ? "Hide" : "View raw"}
                  </Button>
                </div>

                {open ? (
                  <div className="mt-3 space-y-3">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-background p-3 text-xs text-foreground">
                      {email.raw_text ||
                        email.raw_html ||
                        "(No raw body stored for this import)"}
                    </pre>
                    {email.ai_summary ? (
                      <div className="rounded-[8px] border border-brand/30 bg-brand-light p-3 text-sm">
                        <p className="text-xs font-semibold uppercase text-brand">
                          AI summary
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">
                          {email.ai_summary}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            setError(null);
                            try {
                              await summarizeImportedEmailAction(email.id);
                              setMessage("Summary ready");
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          })
                        }
                      >
                        Summarize
                      </Button>
                      {email.review ? (
                        <>
                          <select
                            className="h-9 rounded-[8px] border border-input bg-white px-2 text-xs"
                            value={selectedAssign}
                            onChange={(e) =>
                              setAssignTrip((prev) => ({
                                ...prev,
                                [email.id]: e.target.value,
                              }))
                            }
                          >
                            {trips.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name || t.destination_name || "Trip"}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending || !selectedAssign}
                            onClick={() =>
                              startTransition(async () => {
                                await assignEmailTripAction({
                                  reviewId: email.review!.id,
                                  tripId: selectedAssign,
                                });
                                setMessage("Trip assigned");
                              })
                            }
                          >
                            Assign trip
                          </Button>
                          {email.review.status === "pending" &&
                          selectedAssign ? (
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                startTransition(async () => {
                                  await confirmEmailImportFromInboxAction({
                                    reviewId: email.review!.id,
                                    tripId: selectedAssign,
                                  });
                                  setMessage("Added to itinerary");
                                })
                              }
                            >
                              Confirm to itinerary
                            </Button>
                          ) : null}
                          {email.review.trip_id ? (
                            <Button variant="secondary" size="sm" asChild>
                              <Link href={`/trips/${email.review.trip_id}`}>
                                Open trip
                              </Link>
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                await rejectReservationImportAction(
                                  email.review!.id,
                                );
                                setMessage("Rejected");
                              })
                            }
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
