"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  PLANNING_STAGES,
  nextIncompleteStage,
  stageStatusLabel,
  type GuidedPhase,
  type PlanningProfile,
  type PlanningStageId,
  type StageStatus,
} from "@/lib/itinerary/planning-profile";
import { leaveItineraryHref } from "@/lib/itinerary/leave-routes";
import { Button } from "@/components/ui/button";

function statusClass(status: StageStatus): string {
  switch (status) {
    case "confirmed":
      return "border-success/40 bg-success/10 text-success";
    case "skipped":
      return "border-border bg-background text-muted";
    case "in_progress":
    case "selected":
      return "border-accent/50 bg-accent/20 text-accent-foreground";
    default:
      return "border-border bg-card text-muted";
  }
}

function stageLeaveHref(tripId: string, stage: PlanningStageId | "done") {
  if (stage === "flights") return leaveItineraryHref("flights", tripId);
  if (stage === "hotels") return leaveItineraryHref("hotels", tripId);
  if (stage === "major_activities") {
    return leaveItineraryHref("activities", tripId, { mode: "major" });
  }
  if (stage === "lesser_activities") {
    return leaveItineraryHref("activities", tripId, { mode: "lesser" });
  }
  return `/trips/${tripId}`;
}

function leavesItinerary(stage: PlanningStageId | "done"): boolean {
  return (
    stage === "flights" ||
    stage === "hotels" ||
    stage === "major_activities" ||
    stage === "lesser_activities"
  );
}

export function PlanningProgress({
  tripId,
  profile,
  statuses,
  activeStage,
  onSelectStage,
  onSkipStage,
  onMarkDone,
  pending,
}: {
  tripId: string;
  profile: PlanningProfile;
  statuses: Record<PlanningStageId, StageStatus>;
  activeStage: PlanningStageId | "overview" | "itinerary" | string;
  onSelectStage: (stage: PlanningStageId) => void;
  onSkipStage: (stage: PlanningStageId) => void;
  onMarkDone?: () => void;
  pending?: boolean;
}) {
  const next = nextIncompleteStage(statuses, profile);

  return (
    <section className="space-y-3 rounded-[12px] border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Trip planning</h2>
          <p className="text-xs text-muted">
            Flights → major activities → hotels → lesser activities. Skip any
            stage you already finished elsewhere.
          </p>
        </div>
        {next !== "done" ? (
          <Button asChild size="sm">
            <Link href={stageLeaveHref(tripId, next)}>
              Next: {PLANNING_STAGES.find((s) => s.id === next)?.label}
              {leavesItinerary(next) ? (
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              ) : null}
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="accent"
            disabled={pending || profile.guidedPhase === "done"}
            onClick={onMarkDone}
          >
            {profile.guidedPhase === "done" ? "Planning complete" : "Mark planning done"}
          </Button>
        )}
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PLANNING_STAGES.map((stage, index) => {
          const status = statuses[stage.id];
          const isActive = activeStage === stage.id;
          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => onSelectStage(stage.id)}
                className={`w-full rounded-[10px] border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "border-brand bg-brand-light ring-1 ring-brand"
                    : "border-border bg-card hover:bg-brand-light/60"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Stage {index + 1}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-foreground">
                  {stage.label}
                  {leavesItinerary(stage.id) ? (
                    <ExternalLink
                      className="h-3.5 w-3.5 opacity-60"
                      aria-hidden
                    />
                  ) : null}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold ${statusClass(status)}`}
                >
                  {stageStatusLabel(status)}
                </span>
              </button>
              {status !== "confirmed" &&
              status !== "skipped" &&
              activeStage === stage.id ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={stageLeaveHref(tripId, stage.id)}>
                      Open tools
                      <ExternalLink
                        className="h-3 w-3 opacity-70"
                        aria-hidden
                      />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => onSkipStage(stage.id)}
                  >
                    Skip
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function phaseFromStage(stage: PlanningStageId): GuidedPhase {
  return stage;
}
