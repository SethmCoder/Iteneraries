/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  LEAVE_TRIP_SECTIONS,
  leaveItineraryHref,
} from "@/lib/itinerary/leave-routes";
import { PlanningProgress } from "@/components/itinerary/planning-progress";
import type { PlanningProfile } from "@/lib/itinerary/planning-profile";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("leaveItineraryHref", () => {
  const tripId = "trip-abc";

  it("builds trip-scoped routes for leave-itinerary targets", () => {
    expect(leaveItineraryHref("flights", tripId)).toBe(
      `/flights?tripId=${tripId}&from=plan`,
    );
    expect(leaveItineraryHref("hotels", tripId)).toBe(
      `/hotels?tripId=${tripId}&from=plan`,
    );
    expect(leaveItineraryHref("activities", tripId)).toBe(
      `/suggester?tripId=${tripId}&mode=major`,
    );
    expect(leaveItineraryHref("activities", tripId, { mode: "lesser" })).toBe(
      `/suggester?tripId=${tripId}&mode=lesser`,
    );
    expect(leaveItineraryHref("bookings", tripId)).toBe(
      `/bookings?tripId=${tripId}`,
    );
    expect(leaveItineraryHref("saved-places", tripId)).toBe("/saved-places");
  });
});

describe("leave-itinerary trip section nav", () => {
  it("renders ExternalLink icons and expected hrefs", () => {
    const tripId = "trip-nav-1";
    render(
      <nav aria-label="Trip sections">
        {LEAVE_TRIP_SECTIONS.map((section) => (
          <Link
            key={section.id}
            href={leaveItineraryHref(section.id, tripId)}
          >
            {section.label}
            <ExternalLink data-testid={`ext-${section.id}`} aria-hidden />
          </Link>
        ))}
      </nav>,
    );

    expect(screen.getByRole("link", { name: /Flights/i })).toHaveAttribute(
      "href",
      `/flights?tripId=${tripId}&from=plan`,
    );
    expect(screen.getByRole("link", { name: /Hotels/i })).toHaveAttribute(
      "href",
      `/hotels?tripId=${tripId}&from=plan`,
    );
    expect(screen.getByRole("link", { name: /Activities/i })).toHaveAttribute(
      "href",
      `/suggester?tripId=${tripId}&mode=major`,
    );
    expect(screen.getByRole("link", { name: /Bookings/i })).toHaveAttribute(
      "href",
      `/bookings?tripId=${tripId}`,
    );

    for (const section of LEAVE_TRIP_SECTIONS) {
      expect(screen.getByTestId(`ext-${section.id}`)).toBeTruthy();
    }
  });
});

describe("PlanningProgress leave CTAs", () => {
  it("shows ExternalLink on Next / Open tools that leave the itinerary", () => {
    const tripId = "trip-plan-1";
    const profile: PlanningProfile = { guidedPhase: "flights" };
    const statuses = {
      flights: "not_started" as const,
      major_activities: "not_started" as const,
      hotels: "not_started" as const,
      lesser_activities: "not_started" as const,
    };

    const { container } = render(
      <PlanningProgress
        tripId={tripId}
        profile={profile}
        statuses={statuses}
        activeStage="flights"
        onSelectStage={() => {}}
        onSkipStage={() => {}}
      />,
    );

    const next = screen.getByRole("link", { name: /Next: Flights/i });
    expect(next).toHaveAttribute(
      "href",
      `/flights?tripId=${tripId}&from=plan`,
    );
    expect(next.querySelector("svg")).toBeTruthy();

    const openTools = screen.getByRole("link", { name: /Open tools/i });
    expect(openTools).toHaveAttribute(
      "href",
      `/flights?tripId=${tripId}&from=plan`,
    );
    expect(openTools.querySelector("svg")).toBeTruthy();

    // Stage cards that leave also carry an external-link icon
    const externalIcons = container.querySelectorAll("svg.lucide-external-link");
    expect(externalIcons.length).toBeGreaterThanOrEqual(2);
  });
});
