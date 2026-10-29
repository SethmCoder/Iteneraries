"use client";

import { useState, useTransition } from "react";
import { createTripAction } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialGuidedPhase,
  type PlanningProfile,
  type PlanningScenario,
} from "@/lib/itinerary/planning-profile";

const SCENARIOS: { id: PlanningScenario; title: string; body: string }[] = [
  {
    id: "destination_and_dates",
    title: "I know where and when",
    body: "Destination and travel dates are set.",
  },
  {
    id: "destination_flexible_dates",
    title: "I know where, dates are flexible",
    body: "Destination fixed; window of dates is open.",
  },
  {
    id: "dates_flexible_destination",
    title: "I know when, not where",
    body: "Dates fixed; choosing among destinations.",
  },
  {
    id: "both_flexible",
    title: "Both are flexible",
    body: "Exploring options for place and timing.",
  },
  {
    id: "fixed_event",
    title: "Built around a fixed event",
    body: "Wedding, conference, or other must-attend commitment.",
  },
];

export function AdaptiveTripSetup() {
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<PlanningScenario | null>(null);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [mustDo, setMustDo] = useState("");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");
  const [cashVsPoints, setCashVsPoints] = useState<"cash" | "points" | "either">(
    "either",
  );
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [originAirports, setOriginAirports] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function next() {
    setError(null);
    if (step === 0 && !scenario) {
      setError("Choose how you want to start");
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  }

  function create() {
    setError(null);
    if (startDate && endDate && endDate < startDate) {
      setError("End date cannot be earlier than start date");
      return;
    }
    const profile: PlanningProfile = {
      scenario: scenario ?? undefined,
      destinations: destination.trim() ? [destination.trim()] : undefined,
      originAirports: originAirports
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 3)
        .slice(0, 8),
      travelers,
      purpose: purpose.trim() || undefined,
      mustDos: mustDo
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      pace,
      cashVsPoints,
      guidedPhase: initialGuidedPhase(scenario ?? undefined),
      dateFlexibility:
        scenario === "destination_and_dates" || scenario === "fixed_event"
          ? "fixed"
          : scenario === "destination_flexible_dates" || scenario === "both_flexible"
            ? "flexible"
            : "preferred",
      destinationFlexibility:
        scenario === "destination_and_dates" ||
        scenario === "destination_flexible_dates" ||
        scenario === "fixed_event"
          ? "fixed"
          : "flexible",
      fixedEvent:
        scenario === "fixed_event" && eventTitle.trim()
          ? {
              title: eventTitle.trim(),
              date: eventDate || undefined,
              location: destination.trim() || undefined,
            }
          : undefined,
    };

    startTransition(() => {
      void createTripAction({
        name: name.trim() || null,
        destination_name: destination.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        planning_profile: profile,
      }).catch((e: Error) => setError(e.message));
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plan a trip</h1>
        <p className="mt-1 text-sm text-muted">
          Start from what you already know. You can refine details later.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {step === 0 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">What do you already know?</h2>
          <div className="grid gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenario(s.id)}
                className={`rounded-[12px] border p-4 text-left transition-colors ${
                  scenario === s.id
                    ? "border-brand bg-brand-light"
                    : "border-border bg-card hover:bg-brand-light"
                }`}
              >
                <p className="font-semibold text-foreground">{s.title}</p>
                <p className="mt-0.5 text-sm text-muted">{s.body}</p>
              </button>
            ))}
          </div>
          <Button onClick={next} disabled={!scenario}>
            Continue
          </Button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Basics</h2>
          <div className="space-y-1.5">
            <Label htmlFor="trip-name">Trip name</Label>
            <Input
              id="trip-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {scenario !== "dates_flexible_destination" &&
          scenario !== "both_flexible" ? (
            <div className="space-y-1.5">
              <Label htmlFor="dest">Destination</Label>
              <Input
                id="dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City or region"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="dest">Possible destinations</Label>
              <Input
                id="dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Tokyo or Seoul"
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start">
                {scenario?.includes("flexible") ? "Earliest start" : "Start date"}
              </Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">
                {scenario?.includes("flexible") ? "Latest end" : "End date"}
              </Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {scenario === "fixed_event" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event">Fixed event</Label>
                <Input
                  id="event"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Wedding, conference…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-date">Event date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={next}>Continue</Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Preferences</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pax">Travelers</Label>
              <Input
                id="pax"
                type="number"
                min={1}
                max={20}
                value={travelers}
                onChange={(e) => setTravelers(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purpose">Purpose</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Vacation, business…"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="origins">Origin airports (optional)</Label>
            <Input
              id="origins"
              value={originAirports}
              onChange={(e) => setOriginAirports(e.target.value)}
              placeholder="SEA, PDX"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="must">Must-do activities</Label>
            <Input
              id="must"
              value={mustDo}
              onChange={(e) => setMustDo(e.target.value)}
              placeholder="Comma-separated"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pace</Label>
            <div className="flex flex-wrap gap-2">
              {(["relaxed", "balanced", "packed"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPace(p)}
                  className={`rounded-[8px] border px-3 py-1.5 text-sm capitalize ${
                    pace === p
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cash vs points</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["cash", "Cash"],
                  ["points", "Points"],
                  ["either", "Either"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCashVsPoints(id)}
                  className={`rounded-[8px] border px-3 py-1.5 text-sm ${
                    cashVsPoints === id
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button disabled={pending} onClick={create}>
              {pending ? "Creating…" : "Create trip"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
