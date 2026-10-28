"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { renewAccountAction } from "@/app/actions/billing";
import {
  confirmReservationImportAction,
  rejectReservationImportAction,
  updatePreferencesAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/app/actions/settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { daysUntil } from "@/lib/billing/period";
import { PASSWORD_POLICY } from "@/lib/constants";
import {
  minutesToTimeInput,
  timeInputToMinutes,
} from "@/lib/flights/award-check-window";
import { createClient } from "@/lib/supabase/client";
import type { AccountBilling, Profile, UserPreferences } from "@/types/database";

const AWARD_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function SettingsWorkspace({
  email,
  profile,
  preferences,
  pendingReviews,
  trips,
  emailImport,
  billing,
  outboundEmailConfigured,
  initialTab,
}: {
  email: string;
  profile: Profile;
  preferences: UserPreferences | null;
  pendingReviews: Array<{
    id: string;
    extracted_data: Record<string, unknown>;
    imported_emails?: { subject?: string; from_address?: string } | null;
  }>;
  trips: Array<{ id: string; name: string | null; destination_name: string | null }>;
  emailImport: {
    configured: boolean;
    address: string | null;
    aiConfigured: boolean;
  };
  billing: AccountBilling | null;
  outboundEmailConfigured: boolean;
  initialTab?: string | null;
}) {
  const router = useRouter();
  const importsRef = useRef<HTMLElement | null>(null);
  const accountRef = useRef<HTMLElement | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pace, setPace] = useState(preferences?.travel_pace ?? "moderate");
  const [interests, setInterests] = useState(
    (preferences?.interests ?? []).join(", "),
  );
  const [unit, setUnit] = useState(preferences?.distance_unit ?? "km");
  const [tz, setTz] = useState(preferences?.timezone_display ?? "destination");
  const [modes, setModes] = useState<string[]>(
    preferences?.preferred_transport_modes ?? ["walking", "transit"],
  );
  const [awardCheckEnabled, setAwardCheckEnabled] = useState(
    preferences?.award_check_enabled ?? true,
  );
  const [awardTz, setAwardTz] = useState(
    preferences?.award_check_timezone ?? "UTC",
  );
  const [awardStart, setAwardStart] = useState(
    minutesToTimeInput(preferences?.award_check_start_minute ?? 1080),
  );
  const [awardEnd, setAwardEnd] = useState(
    minutesToTimeInput(preferences?.award_check_end_minute ?? 1260),
  );
  const [awardApprove, setAwardApprove] = useState(
    preferences?.award_approve_to_book ?? true,
  );

  async function saveProfile() {
    setError(null);
    try {
      await updateProfileAction({
        username,
        display_name: displayName || null,
      });
      setMessage("Profile saved");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function savePrefs() {
    setError(null);
    try {
      await updatePreferencesAction({
        preferred_transport_modes: modes,
        travel_pace: pace,
        interests: interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        distance_unit: unit,
        timezone_display: tz,
        auto_confirm_imports: preferences?.auto_confirm_imports ?? false,
        award_check_enabled: awardCheckEnabled,
        award_check_timezone: awardTz,
        award_check_start_minute: timeInputToMinutes(awardStart),
        award_check_end_minute: timeInputToMinutes(awardEnd),
        award_approve_to_book: awardApprove,
      });
      setMessage("Preferences saved");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function resetPassword() {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setError("Unable to send password reset email");
      return;
    }
    setMessage("Password reset email sent (if outbound email is configured)");
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    if (initialTab === "imports" && importsRef.current) {
      importsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (initialTab === "account" && accountRef.current) {
      accountRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialTab]);

  async function renewAccess() {
    setError(null);
    setRenewing(true);
    try {
      const result = await renewAccountAction();
      setMessage(
        `Access renewed through ${new Date(result.periodEnd).toLocaleDateString()}.`,
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRenewing(false);
    }
  }

  const daysLeft = billing ? daysUntil(billing.current_period_end) : null;
  const expired = billing?.status === "expired";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Manage your profile and preferences.</p>
      </div>
      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>
              {profile.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <form
            action={async (fd) => {
              try {
                await uploadAvatarAction(fd);
                setMessage("Avatar updated");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Input name="avatar" type="file" accept="image/*" />
            <Button type="submit" size="sm" className="mt-2">
              Upload avatar
            </Button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display">Display name</Label>
            <Input
              id="display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={() => void saveProfile()}>
          Save profile
        </Button>
      </section>

      <section
        ref={accountRef}
        id="account"
        className="rounded-[12px] border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="font-semibold">Account & access</h2>
        <p className="mt-2 text-sm text-muted">Signed in as {email}</p>
        <p className="mt-1 text-xs text-muted">{PASSWORD_POLICY.description}</p>

        <div className="mt-4 rounded-[10px] border border-border bg-[var(--page-bg)] p-3">
          <p className="text-sm font-semibold">Access period</p>
          {billing ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Plan: <span className="text-foreground">{billing.plan}</span>
                {" · "}
                Status:{" "}
                <span className="text-foreground">{billing.status}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Period ends{" "}
                <span className="font-medium text-foreground">
                  {new Date(billing.current_period_end).toLocaleString()}
                </span>
                {daysLeft != null && !expired
                  ? ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`
                  : null}
              </p>
              {expired ? (
                <p className="mt-2 text-sm text-warning">
                  Access expired
                  {billing.delete_after
                    ? ` — account scheduled for deletion after ${new Date(billing.delete_after).toLocaleDateString()}`
                    : ""}
                  . Renew now to keep your data.
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted">
                Free renew extends access 30 days. This uses the same billing period
                model that will support paid plans later — no throwaway free-only
                path.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              No billing row yet. Press Renew to start a 30-day period.
            </p>
          )}
          <Button
            className="mt-3"
            disabled={renewing}
            onClick={() => void renewAccess()}
          >
            {renewing ? "Renewing…" : "Renew for 30 days"}
          </Button>
        </div>

        <div className="mt-4 rounded-[10px] border border-border p-3">
          <p className="text-sm font-semibold">Email notifications</p>
          <p className="mt-1 text-xs text-muted">
            Alerts (friends, trip edits, award matches, renewal) go to{" "}
            <strong>{email}</strong>
            {outboundEmailConfigured
              ? " via Resend."
              : ". Set RESEND_API_KEY and RESEND_FROM_EMAIL to enable outbound mail."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void resetPassword()}>
            Send password reset email
          </Button>
          <Button variant="outline" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Travel preferences</h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Preferred transport</Label>
            <div className="flex flex-wrap gap-2">
              {["walking", "car", "bicycle", "transit"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rounded-[8px] border px-3 py-1 text-sm capitalize ${
                    modes.includes(m)
                      ? "border-brand bg-brand-light text-brand"
                      : "border-border"
                  }`}
                  onClick={() =>
                    setModes((prev) =>
                      prev.includes(m)
                        ? prev.filter((x) => x !== m)
                        : [...prev, m],
                    )
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pace">Travel pace</Label>
            <select
              id="pace"
              className="h-10 w-full rounded-[8px] border border-input px-3 text-sm"
              value={pace}
              onChange={(e) =>
                setPace(e.target.value as "relaxed" | "moderate" | "packed")
              }
            >
              <option value="relaxed">Relaxed</option>
              <option value="moderate">Moderate</option>
              <option value="packed">Packed</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interests">Interests (comma-separated)</Label>
            <Input
              id="interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="museums, coffee, architecture"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="unit">Distance unit</Label>
              <select
                id="unit"
                className="h-10 w-full rounded-[8px] border border-input px-3 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value as "km" | "mi")}
              >
                <option value="km">Kilometers</option>
                <option value="mi">Miles</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone display</Label>
              <select
                id="tz"
                className="h-10 w-full rounded-[8px] border border-input px-3 text-sm"
                value={tz}
                onChange={(e) =>
                  setTz(
                    e.target.value as "destination" | "home" | "utc",
                  )
                }
              >
                <option value="destination">Destination</option>
                <option value="home">Home</option>
                <option value="utc">UTC</option>
              </select>
            </div>
          </div>
          <Button onClick={() => void savePrefs()}>Save preferences</Button>
        </div>
      </section>

      <section
        id="award-monitoring"
        className="rounded-[12px] border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="font-semibold">Award monitoring</h2>
        <p className="mt-1 text-sm text-muted">
          We look for award seats in this window so alerts arrive when you can
          book. Outside the window, monitoring waits.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={awardCheckEnabled}
              onChange={(e) => setAwardCheckEnabled(e.target.checked)}
            />
            Only check awards during my booking window
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="award-tz">Timezone</Label>
            <select
              id="award-tz"
              className="h-10 w-full rounded-[8px] border border-input px-3 text-sm"
              value={awardTz}
              onChange={(e) => setAwardTz(e.target.value)}
            >
              {AWARD_TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
              {!AWARD_TIMEZONES.includes(awardTz) ? (
                <option value={awardTz}>{awardTz}</option>
              ) : null}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="award-start">Window start</Label>
              <Input
                id="award-start"
                type="time"
                value={awardStart}
                onChange={(e) => setAwardStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="award-end">Window end</Label>
              <Input
                id="award-end"
                type="time"
                value={awardEnd}
                onChange={(e) => setAwardEnd(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={awardApprove}
              onChange={(e) => setAwardApprove(e.target.checked)}
            />
            Ask me before opening booking (Approve &amp; book links)
          </label>
          <p className="text-xs text-muted">
            Approve opens the airline site only after you confirm. Waypoint never
            redeems miles for you.
          </p>
          <Button onClick={() => void savePrefs()}>Save award settings</Button>
        </div>
      </section>

      <section
        ref={importsRef}
        id="imports"
        className="rounded-[12px] border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="font-semibold">Email import</h2>
        {!emailImport.configured ? (
          <p className="mt-2 text-sm text-warning">
            Email import needs configuration. Set RESEND_WEBHOOK_SECRET and
            INBOUND_EMAIL_ADDRESS, then point Resend inbound webhooks to{" "}
            <code className="text-xs">/api/webhooks/inbound-email</code>.
          </p>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            <p>
              Forward confirmation emails to{" "}
              <code className="rounded bg-brand-light px-1.5 py-0.5 text-brand">
                {emailImport.address}
              </code>
            </p>
            {!emailImport.aiConfigured ? (
              <p className="text-warning">
                Extraction requires OPENAI_API_KEY before imports can be parsed.
              </p>
            ) : null}
          </div>
        )}

        {pendingReviews.length > 0 ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold">Ready for review</h3>
            {pendingReviews.map((review) => (
              <ImportReviewCard
                key={review.id}
                review={review}
                trips={trips}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No pending imports.</p>
        )}
      </section>
    </div>
  );
}

function ImportReviewCard({
  review,
  trips,
}: {
  review: {
    id: string;
    extracted_data: Record<string, unknown>;
    imported_emails?: { subject?: string; from_address?: string } | null;
  };
  trips: Array<{ id: string; name: string | null; destination_name: string | null }>;
}) {
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [json, setJson] = useState(
    JSON.stringify(review.extracted_data, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-[10px] border border-border p-3">
      <p className="text-sm font-medium">
        {review.imported_emails?.subject || "Imported reservation"}
      </p>
      <p className="text-xs text-muted">
        {review.imported_emails?.from_address}
      </p>
      <textarea
        className="mt-2 h-40 w-full rounded-[8px] border border-input p-2 font-mono text-xs"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-[8px] border border-input px-2 text-sm"
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || t.destination_name || "Untitled Trip"}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!tripId}
          onClick={async () => {
            try {
              const extracted = JSON.parse(json) as Record<string, unknown>;
              await confirmReservationImportAction({
                reviewId: review.id,
                tripId,
                extracted,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Confirm import
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void rejectReservationImportAction(review.id)}
        >
          Reject
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
