"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const MapInner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-[12px] border border-border bg-card text-sm text-muted">
      Loading map…
    </div>
  ),
});

export type { MapRouteSegment, MapItineraryPin } from "./map-inner";

export function WaypointMap(props: ComponentProps<typeof MapInner>) {
  return <MapInner {...props} />;
}
