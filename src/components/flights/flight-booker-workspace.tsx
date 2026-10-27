"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plane,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  deleteAwardSearchAction,
  deleteLoyaltyBalanceAction,
  runAwardSearchAction,
  runDueAwardChecksAction,
  saveAwardSearchAction,
  saveLoyaltyBalanceAction,
  setAwardSearchPausedAction,
} from "@/app/actions/flights";
import {
  disconnectAwardWalletAction,
  syncAwardWalletBalancesAction,
} from "@/app/actions/loyalty";
import { AirportInput } from "@/components/flights/airport-input";
import { ConnectProgramDialog } from "@/components/flights/connect-program-dialog";
import {
  AirlinePreferenceSelect,
  AlliancePreferenceSelect,
} from "@/components/flights/preference-selects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOYALTY_PROGRAMS } from "@/lib/flights/loyalty-programs";
import { awardSearchFormSchema } from "@/lib/flights/schema";
import type {
  AwardResult,
  AwardSearch,
  AwardSearchStatus,
  LoyaltyBalance,
  LoyaltyConnection,
} from "@/types/database";

type FormState = {
  id?: string;
  origin: string;
  destination: string;
  tripType: "one_way" | "round_trip";
  departDate: string;
  departDateEnd: string;
  returnDate: string;
  returnDateEnd: string;
  passengers: number;
  cabin: AwardSearch["cabin"];
  maxPointsPerPassenger: string;
  maxPointsTotal: string;
  maxCashFees: string;
  preferredProgram: string;
  programs: string[];
  notifyOnMatch: boolean;
  requireBookingApproval: boolean;
  pollIntervalMinutes: number;
  departTimeStart: string;
  departTimeEnd: string;
  arriveTimeStart: string;
  arriveTimeEnd: string;
  maxConnections: string;
  preferredAirlines: string[];
  preferredAlliances: string[];
  maxLayoverMinutes: string;
  nearbyAirportsOk: boolean;
  mixedCabinOk: boolean;
  separateTicketsOk: boolean;
};

const emptyForm = (tripId: string | null): FormState => ({
  origin: "",
  destination: "",
  tripType: "one_way",
  departDate: "",
  departDateEnd: "",
  returnDate: "",
  returnDateEnd: "",
  passengers: 1,
  cabin: "economy",
  maxPointsPerPassenger: "",
  maxPointsTotal: "",
  maxCashFees: "",
  preferredProgram: "",
  programs: [],
  notifyOnMatch: true,
  requireBookingApproval: true,
  pollIntervalMinutes: 360,
  departTimeStart: "",
  departTimeEnd: "",
  arriveTimeStart: "",
  arriveTimeEnd: "",
  maxConnections: "1",
  preferredAirlines: [],
  preferredAlliances: [],
  maxLayoverMinutes: "",
  nearbyAirportsOk: true,
  mixedCabinOk: false,
  separateTicketsOk: false,
  ...(tripId ? {} : {}),
});

function statusLabel(status: AwardSearchStatus) {
  switch (status) {
    case "monitoring":
      return "Monitoring";
    case "match_found":
      return "Match Found";
    case "paused":
      return "Paused";
    default:
      return "Setup Required";
  }
}

function statusClass(status: AwardSearchStatus) {
  switch (status) {
    case "monitoring":
      return "bg-brand-light text-brand border-brand/20";
    case "match_found":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "paused":
      return "bg-gray-100 text-muted border-border";
    default:
      return "bg-amber-50 text-amber-800 border-amber-200";
  }
}

function searchToForm(search: AwardSearch, programs: string[]): FormState {
  const p = search.preferences ?? {};
  return {
    id: search.id,
    origin: search.origin,
    destination: search.destination,
    tripType: search.trip_type,
    departDate: search.depart_date ?? "",
    departDateEnd: search.depart_date_end ?? "",
    returnDate: search.return_date ?? "",
    returnDateEnd: search.return_date_end ?? "",
    passengers: search.passengers,
    cabin: search.cabin,
    maxPointsPerPassenger: search.max_points_per_passenger?.toString() ?? "",
    maxPointsTotal: search.max_points_total?.toString() ?? "",
    maxCashFees: search.max_cash_fees?.toString() ?? "",
    preferredProgram: search.preferred_program ?? "",
    programs,
    notifyOnMatch: search.notify_on_match,
    requireBookingApproval: search.require_booking_approval,
    pollIntervalMinutes: search.poll_interval_minutes,
    departTimeStart: p.departTimeStart ?? "",
    departTimeEnd: p.departTimeEnd ?? "",
    arriveTimeStart: p.arriveTimeStart ?? "",
    arriveTimeEnd: p.arriveTimeEnd ?? "",
    maxConnections: p.maxConnections?.toString() ?? "",
    preferredAirlines: p.preferredAirlines ?? [],
    preferredAlliances: p.preferredAlliances ?? [],
    maxLayoverMinutes: p.maxLayoverMinutes?.toString() ?? "",
    nearbyAirportsOk: p.nearbyAirportsOk ?? true,
    mixedCabinOk: p.mixedCabinOk ?? false,
    separateTicketsOk: p.separateTicketsOk ?? false,
  };
}

function formToPayload(form: FormState, tripId: string | null) {
  return {
    id: form.id,
    tripId,
    origin: form.origin,
    destination: form.destination,
    tripType: form.tripType,
    departDate: form.departDate || null,
    departDateEnd: form.departDateEnd || null,
    returnDate: form.returnDate || null,
    returnDateEnd: form.returnDateEnd || null,
    passengers: form.passengers,
    cabin: form.cabin,
    maxPointsPerPassenger: form.maxPointsPerPassenger
      ? Number(form.maxPointsPerPassenger)
      : null,
    maxPointsTotal: form.maxPointsTotal ? Number(form.maxPointsTotal) : null,
    maxCashFees: form.maxCashFees ? Number(form.maxCashFees) : null,
    preferredProgram: form.preferredProgram || null,
    programs: form.programs,
    notifyOnMatch: form.notifyOnMatch,
    requireBookingApproval: form.requireBookingApproval,
    pollIntervalMinutes: form.pollIntervalMinutes,
    preferences: {
      departTimeStart: form.departTimeStart || null,
      departTimeEnd: form.departTimeEnd || null,
      arriveTimeStart: form.arriveTimeStart || null,
      arriveTimeEnd: form.arriveTimeEnd || null,
      maxConnections: form.maxConnections ? Number(form.maxConnections) : null,
      preferredAirlines: form.preferredAirlines,
      preferredAlliances: form.preferredAlliances,
      maxLayoverMinutes: form.maxLayoverMinutes
        ? Number(form.maxLayoverMinutes)
        : null,
      nearbyAirportsOk: form.nearbyAirportsOk,
      mixedCabinOk: form.mixedCabinOk,
      separateTicketsOk: form.separateTicketsOk,
    },
  };
}

export function FlightBookerWorkspace({
  searches: initialSearches,
  resultsBySearch,
  programsBySearch,
  balances: initialBalances,
  loyaltyConnection: initialConnection,
  loyaltyLinkConfigured,
  webParseConfigured,
  tripId,
  awardConfigured,
  emailForward,
  isDemo,
  loyaltyFlash,
}: {
  searches: AwardSearch[];
  resultsBySearch: Record<string, AwardResult[]>;
  programsBySearch: Record<string, string[]>;
  balances: LoyaltyBalance[];
  loyaltyConnection: LoyaltyConnection | null;
  loyaltyLinkConfigured: boolean;
  webParseConfigured: boolean;
  tripId: string | null;
  awardConfigured: boolean;
  emailForward: {
    configured: boolean;
    address: string | null;
  };
  isDemo: boolean;
  loyaltyFlash?: string | null;
}) {
  const [searches, setSearches] = useState(initialSearches);
  const [resultsMap] = useState(resultsBySearch);
  const [programsMap, setProgramsMap] = useState(programsBySearch);
  const [balances, setBalances] = useState(initialBalances);
  const [loyaltyConnection, setLoyaltyConnection] = useState(initialConnection);
  const [form, setForm] = useState<FormState>(() => emptyForm(tripId));
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(
    loyaltyFlash ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bookUrl, setBookUrl] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<
    "points" | "fees" | "duration" | "stops" | "depart"
  >("points");
  const [filterAirline, setFilterAirline] = useState("");
  const [loyaltyProgram, setLoyaltyProgram] = useState("united");
  const [loyaltyBalance, setLoyaltyBalance] = useState("");
  const [copied, setCopied] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMode, setConnectMode] = useState<"link" | "sync">("link");
  const [connectProgram, setConnectProgram] = useState("singapore");

  useEffect(() => {
    if (isDemo || !awardConfigured) return;
    void runDueAwardChecksAction()
      .then((result) => {
        if (!result.skipped && result.checked > 0) {
          setActionMessage(
            `Ran ${result.checked} award check(s) in your booking window.`,
          );
        }
      })
      .catch(() => {
        /* ignore opportunistic check errors */
      });
  }, [isDemo, awardConfigured]);

  const detailSearch = searches.find((s) => s.id === detailId) ?? null;
  const detailResults = useMemo(() => {
    const list = detailId ? (resultsMap[detailId] ?? []) : [];
    let filtered = list;
    if (filterAirline.trim()) {
      const q = filterAirline.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.airline?.toLowerCase().includes(q) ||
          r.flight_numbers?.toLowerCase().includes(q) ||
          r.loyalty_program?.toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "fees":
          return (a.taxes_fees ?? 1e12) - (b.taxes_fees ?? 1e12);
        case "duration":
          return (a.duration_minutes ?? 1e12) - (b.duration_minutes ?? 1e12);
        case "stops":
          return a.stops - b.stops;
        case "depart":
          return (a.depart_at ?? "").localeCompare(b.depart_at ?? "");
        default:
          return (
            (a.points_per_passenger ?? 1e12) - (b.points_per_passenger ?? 1e12)
          );
      }
    });
  }, [detailId, resultsMap, sortKey, filterAirline]);

  function patchForm(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function saveSearch() {
    setFormError(null);
    setActionMessage(null);
    const payload = formToPayload(form, tripId);
    const parsed = awardSearchFormSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid search");
      return;
    }
    if (isDemo) {
      const now = new Date().toISOString();
      const id = form.id ?? crypto.randomUUID();
      const row: AwardSearch = {
        id,
        user_id: "demo",
        trip_id: tripId,
        origin: parsed.data.origin.toUpperCase(),
        destination: parsed.data.destination.toUpperCase(),
        trip_type: parsed.data.tripType,
        depart_date: parsed.data.departDate ?? null,
        depart_date_end: parsed.data.departDateEnd ?? null,
        return_date: parsed.data.returnDate ?? null,
        return_date_end: parsed.data.returnDateEnd ?? null,
        passengers: parsed.data.passengers,
        cabin: parsed.data.cabin,
        max_points_per_passenger: parsed.data.maxPointsPerPassenger ?? null,
        max_points_total: parsed.data.maxPointsTotal ?? null,
        max_cash_fees: parsed.data.maxCashFees ?? null,
        preferred_program: parsed.data.preferredProgram ?? null,
        status: awardConfigured ? "monitoring" : "setup_required",
        notify_on_match: parsed.data.notifyOnMatch,
        require_booking_approval: parsed.data.requireBookingApproval,
        poll_interval_minutes: parsed.data.pollIntervalMinutes,
        last_checked_at: null,
        last_notified_fingerprint: null,
        paused_at: null,
        preferences: parsed.data.preferences,
        created_at: now,
        updated_at: now,
      };
      setSearches((prev) => {
        const rest = prev.filter((s) => s.id !== id);
        return [row, ...rest];
      });
      setProgramsMap((prev) => ({ ...prev, [id]: parsed.data.programs }));
      setForm(emptyForm(tripId));
      setActionMessage(
        awardConfigured
          ? "Search saved (preview)."
          : "Search saved. Live award inventory requires SEATS_AERO_API_KEY.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const { id } = await saveAwardSearchAction(parsed.data);
        setActionMessage(
          awardConfigured
            ? "Search saved. Monitoring will run on the schedule."
            : "Search saved with Setup Required — add SEATS_AERO_API_KEY for live awards.",
        );
        setForm(emptyForm(tripId));
        setSearches((prev) => {
          const existing = prev.find((s) => s.id === id);
          if (existing) {
            return prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    ...parsed.data,
                    origin: parsed.data.origin.toUpperCase(),
                    destination: parsed.data.destination.toUpperCase(),
                    trip_type: parsed.data.tripType,
                    depart_date: parsed.data.departDate ?? null,
                    depart_date_end: parsed.data.departDateEnd ?? null,
                    return_date: parsed.data.returnDate ?? null,
                    return_date_end: parsed.data.returnDateEnd ?? null,
                    max_points_per_passenger:
                      parsed.data.maxPointsPerPassenger ?? null,
                    max_points_total: parsed.data.maxPointsTotal ?? null,
                    max_cash_fees: parsed.data.maxCashFees ?? null,
                    preferred_program: parsed.data.preferredProgram ?? null,
                    notify_on_match: parsed.data.notifyOnMatch,
                    require_booking_approval: parsed.data.requireBookingApproval,
                    poll_interval_minutes: parsed.data.pollIntervalMinutes,
                    preferences: parsed.data.preferences,
                    status: awardConfigured ? "monitoring" : "setup_required",
                  }
                : s,
            );
          }
          return [
            {
              id,
              user_id: "",
              trip_id: tripId,
              origin: parsed.data.origin.toUpperCase(),
              destination: parsed.data.destination.toUpperCase(),
              trip_type: parsed.data.tripType,
              depart_date: parsed.data.departDate ?? null,
              depart_date_end: parsed.data.departDateEnd ?? null,
              return_date: parsed.data.returnDate ?? null,
              return_date_end: parsed.data.returnDateEnd ?? null,
              passengers: parsed.data.passengers,
              cabin: parsed.data.cabin,
              max_points_per_passenger:
                parsed.data.maxPointsPerPassenger ?? null,
              max_points_total: parsed.data.maxPointsTotal ?? null,
              max_cash_fees: parsed.data.maxCashFees ?? null,
              preferred_program: parsed.data.preferredProgram ?? null,
              status: awardConfigured ? "monitoring" : "setup_required",
              notify_on_match: parsed.data.notifyOnMatch,
              require_booking_approval: parsed.data.requireBookingApproval,
              poll_interval_minutes: parsed.data.pollIntervalMinutes,
              last_checked_at: null,
              last_notified_fingerprint: null,
              paused_at: null,
              preferences: parsed.data.preferences,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            ...prev,
          ];
        });
        setProgramsMap((prev) => ({ ...prev, [id]: parsed.data.programs }));
      } catch (e) {
        setFormError((e as Error).message);
      }
    });
  }

  function runSearch(id: string) {
    setActionMessage(null);
    if (isDemo) {
      setActionMessage(
        awardConfigured
          ? "Manual search queued (preview)."
          : "Live search unavailable until SEATS_AERO_API_KEY is set.",
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await runAwardSearchAction(id);
        setActionMessage(
          result.setupRequired
            ? result.error ?? "Setup required"
            : result.error
              ? result.error
              : `Checked — ${result.count} matching option(s).`,
        );
        setSearches((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: result.status,
                  last_checked_at: new Date().toISOString(),
                }
              : s,
          ),
        );
      } catch (e) {
        setActionMessage((e as Error).message);
      }
    });
  }

  async function copyAddress() {
    if (!emailForward.address) return;
    await navigator.clipboard.writeText(emailForward.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Flight Booker</h1>
          <p className="mt-1 text-sm text-muted">
            Save award-seat searches, track loyalty balances, and get notified when
            qualifying inventory appears. Booking always happens on the airline or
            program site after you confirm.
          </p>
        </div>
        <Badge className={awardConfigured ? "" : "border-amber-200 bg-amber-50 text-amber-800"}>
          {awardConfigured ? "Seats.aero connected" : "Award API not configured"}
        </Badge>
      </div>

      {!awardConfigured ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Live award inventory needs <code className="rounded bg-white/80 px-1">SEATS_AERO_API_KEY</code>.
          You can still create, edit, pause, and delete searches; status stays{" "}
          <strong>Setup Required</strong> until a key is added. Ordinary cash flight
          APIs are never shown as award seats.
        </div>
      ) : null}

      <div className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Forward reservations</h2>
            <p className="mt-0.5 text-xs text-muted">
              Forward booking confirmations to your Waypoint inbound address for review
              in Settings.
            </p>
          </div>
          {emailForward.configured && emailForward.address ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-[8px] bg-brand-light px-2 py-1 text-xs text-brand">
                {emailForward.address}
              </code>
              <Button type="button" size="sm" variant="secondary" onClick={() => void copyAddress()}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-warning">
              Set INBOUND_EMAIL_ADDRESS and Resend webhook to enable forwarding.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm lg:border-r">
          <h2 className="font-semibold">Create a Search</h2>
          <p className="mt-0.5 text-xs text-muted">
            {form.id ? "Editing saved search" : "New award-flight watch"}
            {tripId ? " · linked to current trip" : ""}
          </p>

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="origin">Origin</Label>
                <AirportInput
                  id="origin"
                  value={form.origin}
                  onChange={(origin) => patchForm({ origin })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination">Destination</Label>
                <AirportInput
                  id="destination"
                  value={form.destination}
                  onChange={(destination) => patchForm({ destination })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tripType">Trip type</Label>
                <select
                  id="tripType"
                  className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                  value={form.tripType}
                  onChange={(e) =>
                    patchForm({
                      tripType: e.target.value as FormState["tripType"],
                    })
                  }
                >
                  <option value="one_way">One-way</option>
                  <option value="round_trip">Round-trip</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cabin">Cabin</Label>
                <select
                  id="cabin"
                  className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                  value={form.cabin}
                  onChange={(e) =>
                    patchForm({ cabin: e.target.value as FormState["cabin"] })
                  }
                >
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="departDate">Departure date</Label>
                <Input
                  id="departDate"
                  type="date"
                  value={form.departDate}
                  onChange={(e) => patchForm({ departDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="departDateEnd">Flexible until</Label>
                <Input
                  id="departDateEnd"
                  type="date"
                  value={form.departDateEnd}
                  onChange={(e) => patchForm({ departDateEnd: e.target.value })}
                />
              </div>
            </div>

            {form.tripType === "round_trip" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="returnDate">Return date</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={form.returnDate}
                    onChange={(e) => patchForm({ returnDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="returnDateEnd">Return flexible until</Label>
                  <Input
                    id="returnDateEnd"
                    type="date"
                    value={form.returnDateEnd}
                    onChange={(e) =>
                      patchForm({ returnDateEnd: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="passengers">Passengers</Label>
                <Input
                  id="passengers"
                  type="number"
                  min={1}
                  max={9}
                  value={form.passengers}
                  onChange={(e) =>
                    patchForm({ passengers: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxConn">Max connections</Label>
                <Input
                  id="maxConn"
                  type="number"
                  min={0}
                  max={4}
                  value={form.maxConnections}
                  onChange={(e) =>
                    patchForm({ maxConnections: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="layover">Max layover (min)</Label>
                <Input
                  id="layover"
                  type="number"
                  min={30}
                  value={form.maxLayoverMinutes}
                  onChange={(e) =>
                    patchForm({ maxLayoverMinutes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Preferred departure window</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={form.departTimeStart}
                    onChange={(e) =>
                      patchForm({ departTimeStart: e.target.value })
                    }
                  />
                  <Input
                    type="time"
                    value={form.departTimeEnd}
                    onChange={(e) =>
                      patchForm({ departTimeEnd: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Preferred arrival window</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={form.arriveTimeStart}
                    onChange={(e) =>
                      patchForm({ arriveTimeStart: e.target.value })
                    }
                  />
                  <Input
                    type="time"
                    value={form.arriveTimeEnd}
                    onChange={(e) =>
                      patchForm({ arriveTimeEnd: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AirlinePreferenceSelect
                value={form.preferredAirlines}
                onChange={(preferredAirlines) =>
                  patchForm({ preferredAirlines })
                }
              />
              <AlliancePreferenceSelect
                value={form.preferredAlliances}
                onChange={(preferredAlliances) =>
                  patchForm({ preferredAlliances })
                }
              />
            </div>

            <div className="rounded-[10px] border border-border bg-[var(--page-bg)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Points & booking
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="maxPts">Max points / passenger</Label>
                  <Input
                    id="maxPts"
                    type="number"
                    value={form.maxPointsPerPassenger}
                    onChange={(e) =>
                      patchForm({ maxPointsPerPassenger: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxPtsTotal">Max total points</Label>
                  <Input
                    id="maxPtsTotal"
                    type="number"
                    value={form.maxPointsTotal}
                    onChange={(e) =>
                      patchForm({ maxPointsTotal: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxFees">Max taxes & fees (cash)</Label>
                  <Input
                    id="maxFees"
                    type="number"
                    value={form.maxCashFees}
                    onChange={(e) => patchForm({ maxCashFees: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="program">Preferred loyalty program</Label>
                  <select
                    id="program"
                    className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                    value={form.preferredProgram}
                    onChange={(e) =>
                      patchForm({ preferredProgram: e.target.value })
                    }
                  >
                    <option value="">Any</option>
                    {LOYALTY_PROGRAMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.nearbyAirportsOk}
                    onChange={(e) =>
                      patchForm({ nearbyAirportsOk: e.target.checked })
                    }
                  />
                  Nearby airports OK
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.mixedCabinOk}
                    onChange={(e) =>
                      patchForm({ mixedCabinOk: e.target.checked })
                    }
                  />
                  Mixed-cabin itineraries OK
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.separateTicketsOk}
                    onChange={(e) =>
                      patchForm({ separateTicketsOk: e.target.checked })
                    }
                  />
                  Separate tickets OK
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.notifyOnMatch}
                    onChange={(e) =>
                      patchForm({ notifyOnMatch: e.target.checked })
                    }
                  />
                  Notify me when matches appear
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.requireBookingApproval}
                    onChange={(e) =>
                      patchForm({ requireBookingApproval: e.target.checked })
                    }
                  />
                  Require my approval before booking handoff
                </label>
              </div>

              <div className="mt-3 space-y-1.5">
                <Label>Eligible programs for this search</Label>
                <div className="flex flex-wrap gap-2">
                  {LOYALTY_PROGRAMS.map((p) => {
                    const on = form.programs.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`rounded-[8px] border px-2 py-1 text-xs ${
                          on
                            ? "border-brand bg-brand-light text-brand"
                            : "border-border bg-white text-muted"
                        }`}
                        onClick={() =>
                          patchForm({
                            programs: on
                              ? form.programs.filter((x) => x !== p.id)
                              : [...form.programs, p.id],
                          })
                        }
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            {actionMessage ? (
              <p className="text-sm text-brand">{actionMessage}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={saveSearch}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {form.id ? "Update search" : "Save search"}
              </Button>
              {form.id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setForm(emptyForm(tripId))}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Loyalty balances</h2>
            <p className="mt-0.5 text-xs text-muted">
              Connect a program directly (e.g. KrisFlyer) or sync AwardWallet.
              Waypoint does not store airline passwords. Manual entry remains a
              fallback. Award checks run in your Settings booking window.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || isDemo}
                onClick={() => {
                  setConnectMode("link");
                  setConnectProgram(loyaltyProgram);
                  setConnectOpen(true);
                }}
              >
                Connect program
              </Button>
              {loyaltyLinkConfigured ? (
                loyaltyConnection?.status === "connected" ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending || isDemo}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            const result = await syncAwardWalletBalancesAction();
                            setActionMessage(
                              `Synced ${result.count} AwardWallet balance(s).`,
                            );
                          } catch (e) {
                            setActionMessage((e as Error).message);
                          }
                        });
                      }}
                    >
                      Sync AwardWallet
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending || isDemo}
                      onClick={() => {
                        startTransition(async () => {
                          await disconnectAwardWalletAction();
                          setLoyaltyConnection((prev) =>
                            prev ? { ...prev, status: "disconnected" } : prev,
                          );
                        });
                      }}
                    >
                      Disconnect
                    </Button>
                    <span className="self-center text-xs text-muted">
                      AwardWallet connected
                      {loyaltyConnection.last_synced_at
                        ? ` · synced ${new Date(loyaltyConnection.last_synced_at).toLocaleString()}`
                        : ""}
                    </span>
                  </>
                ) : (
                  <Button type="button" variant="secondary" asChild>
                    <a href="/api/loyalty/awardwallet/connect">
                      Connect AwardWallet
                    </a>
                  </Button>
                )
              ) : (
                <p className="w-full text-xs text-muted">
                  Optional: set <code>AWARDWALLET_API_KEY</code> to sync an existing
                  AwardWallet account.
                </p>
              )}
              {!webParseConfigured ? (
                <p className="w-full text-xs text-warning">
                  Set <code>AWARDWALLET_WEB_USER</code> /{" "}
                  <code>AWARDWALLET_WEB_PASSWORD</code> to enable Connect program.
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                className="h-10 rounded-[8px] border border-input bg-white px-3 text-sm"
                value={loyaltyProgram}
                onChange={(e) => setLoyaltyProgram(e.target.value)}
              >
                {LOYALTY_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Input
                className="w-36"
                type="number"
                min={0}
                placeholder="Balance"
                value={loyaltyBalance}
                onChange={(e) => setLoyaltyBalance(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  const balance = Number(loyaltyBalance);
                  if (!Number.isFinite(balance) || balance < 0) return;
                  if (isDemo) {
                    const now = new Date().toISOString();
                    setBalances((prev) => {
                      const rest = prev.filter(
                        (b) => b.program !== loyaltyProgram,
                      );
                      return [
                        {
                          id: crypto.randomUUID(),
                          user_id: "demo",
                          program: loyaltyProgram,
                          balance,
                          currency_label: "points",
                          source: "manual",
                          last_verified_at: now,
                          external_account_id: null,
                          provider: null,
                          created_at: now,
                          updated_at: now,
                        },
                        ...rest,
                      ];
                    });
                    setLoyaltyBalance("");
                    return;
                  }
                  startTransition(async () => {
                    await saveLoyaltyBalanceAction({
                      program: loyaltyProgram,
                      balance,
                      currencyLabel: "points",
                    });
                    setLoyaltyBalance("");
                    setBalances((prev) => {
                      const rest = prev.filter(
                        (b) => b.program !== loyaltyProgram,
                      );
                      return [
                        {
                          id: crypto.randomUUID(),
                          user_id: "",
                          program: loyaltyProgram,
                          balance,
                          currency_label: "points",
                          source: "manual",
                          last_verified_at: new Date().toISOString(),
                          external_account_id: null,
                          provider: null,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        },
                        ...rest,
                      ];
                    });
                  });
                }}
              >
                Save balance
              </Button>
            </div>
            <ConnectProgramDialog
              open={connectOpen}
              onOpenChange={setConnectOpen}
              initialProgram={connectProgram}
              mode={connectMode}
              webParseConfigured={webParseConfigured}
              disabled={isDemo}
              onLinked={(result) => {
                setActionMessage(
                  `Linked ${result.program}: ${result.balance.toLocaleString()} points.`,
                );
                const now = new Date().toISOString();
                setBalances((prev) => {
                  const rest = prev.filter((b) => b.program !== result.program);
                  return [
                    {
                      id: crypto.randomUUID(),
                      user_id: "",
                      program: result.program,
                      balance: result.balance,
                      currency_label: "points",
                      source: "verified",
                      last_verified_at: now,
                      external_account_id: null,
                      provider: "awardwallet_parse",
                      created_at: now,
                      updated_at: now,
                    },
                    ...rest,
                  ];
                });
              }}
            />
            <ul className="mt-3 space-y-2">
              {balances.length === 0 ? (
                <li className="text-sm text-muted">No balances recorded yet.</li>
              ) : (
                balances.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {LOYALTY_PROGRAMS.find((p) => p.id === b.program)
                          ?.label ?? b.program}
                      </p>
                      <p className="text-xs text-muted">
                        {b.balance.toLocaleString()} {b.currency_label} ·{" "}
                        {b.source === "verified"
                          ? b.provider === "awardwallet_parse"
                            ? "Verified via Connect"
                            : `Verified${b.provider ? ` via ${b.provider}` : ""}`
                          : "Manual"}
                        {b.last_verified_at
                          ? ` · ${new Date(b.last_verified_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                    {b.provider === "awardwallet_parse" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || isDemo}
                        onClick={() => {
                          setConnectMode("sync");
                          setConnectProgram(b.program);
                          setConnectOpen(true);
                        }}
                      >
                        Sync
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (isDemo) {
                          setBalances((prev) =>
                            prev.filter((x) => x.id !== b.id),
                          );
                          return;
                        }
                        startTransition(async () => {
                          await deleteLoyaltyBalanceAction(b.id);
                          setBalances((prev) =>
                            prev.filter((x) => x.id !== b.id),
                          );
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Your Searches</h2>
            <p className="mt-0.5 text-xs text-muted">
              Checks run in your Settings booking window (daily cron + when you open
              this page). Book quickly when notified — seats can disappear.
            </p>
            <div className="mt-3 space-y-3">
              {searches.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center">
                  <Plane className="mx-auto h-8 w-8 text-brand/40" />
                  <p className="mt-2 text-sm font-medium">No searches yet</p>
                  <p className="text-xs text-muted">
                    Create an award search on the left to start watching inventory.
                  </p>
                </div>
              ) : (
                searches.map((s) => {
                  const count = resultsMap[s.id]?.length ?? 0;
                  return (
                    <div
                      key={s.id}
                      className="rounded-[12px] border border-border bg-white p-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {s.origin} → {s.destination}
                          </p>
                          <p className="text-xs text-muted">
                            {s.depart_date ?? "Flexible"}
                            {s.depart_date_end ? ` – ${s.depart_date_end}` : ""}
                            {" · "}
                            {s.passengers} pax · {s.cabin.replace("_", " ")}
                            {s.max_points_per_passenger
                              ? ` · ≤ ${s.max_points_per_passenger.toLocaleString()} pts`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Last checked:{" "}
                            {s.last_checked_at
                              ? new Date(s.last_checked_at).toLocaleString()
                              : "Never"}
                            {count ? ` · ${count} match(es)` : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-[8px] border px-2 py-0.5 text-xs font-semibold ${statusClass(s.status)}`}
                        >
                          {statusLabel(s.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDetailId(s.id)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setForm(
                              searchToForm(s, programsMap[s.id] ?? []),
                            )
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const paused = s.status !== "paused";
                            if (isDemo) {
                              setSearches((prev) =>
                                prev.map((x) =>
                                  x.id === s.id
                                    ? {
                                        ...x,
                                        status: paused
                                          ? "paused"
                                          : awardConfigured
                                            ? "monitoring"
                                            : "setup_required",
                                        paused_at: paused
                                          ? new Date().toISOString()
                                          : null,
                                      }
                                    : x,
                                ),
                              );
                              return;
                            }
                            startTransition(async () => {
                              await setAwardSearchPausedAction(s.id, paused);
                              setSearches((prev) =>
                                prev.map((x) =>
                                  x.id === s.id
                                    ? {
                                        ...x,
                                        status: paused
                                          ? "paused"
                                          : awardConfigured
                                            ? "monitoring"
                                            : "setup_required",
                                        paused_at: paused
                                          ? new Date().toISOString()
                                          : null,
                                      }
                                    : x,
                                ),
                              );
                            });
                          }}
                        >
                          {s.status === "paused" ? (
                            <Play className="h-3.5 w-3.5" />
                          ) : (
                            <Pause className="h-3.5 w-3.5" />
                          )}
                          {s.status === "paused" ? "Resume" : "Pause"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => runSearch(s.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Run now
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (isDemo) {
                              setSearches((prev) =>
                                prev.filter((x) => x.id !== s.id),
                              );
                              return;
                            }
                            startTransition(async () => {
                              await deleteAwardSearchAction(s.id);
                              setSearches((prev) =>
                                prev.filter((x) => x.id !== s.id),
                              );
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailSearch
                ? `${detailSearch.origin} → ${detailSearch.destination}`
                : "Search details"}
            </DialogTitle>
            <DialogDescription>
              Award options from supported providers. Availability can change —
              recheck before booking. Waypoint never redeems points for you.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className="h-9 rounded-[8px] border border-input bg-white px-2 text-sm"
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as typeof sortKey)
              }
            >
              <option value="points">Sort: points</option>
              <option value="fees">Sort: cash fees</option>
              <option value="duration">Sort: duration</option>
              <option value="depart">Sort: departure</option>
              <option value="stops">Sort: stops</option>
            </select>
            <Input
              className="h-9 max-w-[10rem]"
              placeholder="Filter airline"
              value={filterAirline}
              onChange={(e) => setFilterAirline(e.target.value)}
            />
          </div>

          <div className="mt-3 space-y-2">
            {detailResults.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                {detailSearch?.status === "setup_required"
                  ? "No live award data until SEATS_AERO_API_KEY is configured."
                  : "No matching award options yet. Run a search or wait for monitoring."}
              </div>
            ) : (
              detailResults.map((r) => (
                <div
                  key={r.id}
                  className="rounded-[10px] border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {r.airline ?? r.loyalty_program ?? "Award option"}
                        {r.flight_numbers ? ` · ${r.flight_numbers}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {r.origin_airport} → {r.destination_airport}
                        {r.depart_at
                          ? ` · ${new Date(r.depart_at).toLocaleString()}`
                          : ""}
                        {r.duration_minutes != null
                          ? ` · ${Math.round(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                          : ""}
                        {` · ${r.stops} stop${r.stops === 1 ? "" : "s"}`}
                      </p>
                      <p className="mt-1 text-sm">
                        {r.points_per_passenger != null
                          ? `${r.points_per_passenger.toLocaleString()} pts / pax`
                          : "Points TBD"}
                        {r.taxes_fees != null
                          ? ` + ${r.currency ?? "USD"} ${Number(r.taxes_fees).toFixed(2)}`
                          : ""}
                        {r.cabin ? ` · ${r.cabin}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        Source: {r.provider} · {r.availability_status} · checked{" "}
                        {new Date(r.checked_at).toLocaleString()}
                      </p>
                      {r.compromises?.length ? (
                        <p className="mt-1 text-xs text-warning">
                          Compromises: {r.compromises.join("; ")}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      disabled={!r.booking_url}
                      onClick={() => {
                        if (!r.booking_url) return;
                        if (detailSearch?.require_booking_approval !== false) {
                          setBookUrl(r.booking_url);
                        } else {
                          window.open(r.booking_url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Book
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bookUrl} onOpenChange={(o) => !o && setBookUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & open booking site?</DialogTitle>
            <DialogDescription>
              Approve opens the airline booking page. Waypoint does not spend your
              miles or complete checkout for you — you finish login and taxes there.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBookUrl(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (bookUrl) {
                  window.open(bookUrl, "_blank", "noopener,noreferrer");
                }
                setBookUrl(null);
              }}
            >
              Approve & open
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
