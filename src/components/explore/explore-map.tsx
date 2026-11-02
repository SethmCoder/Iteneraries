"use client";

import dynamic from "next/dynamic";

export type ExploreMapMarker = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  title: string;
  subtitle?: string;
};

const ExploreMapInner = dynamic(() => import("./explore-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-[12px] border border-border bg-card text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function ExploreMap({
  markers,
  selectedId,
  onSelect,
  height = "100%",
}: {
  markers: ExploreMapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: string;
}) {
  return (
    <ExploreMapInner
      markers={markers}
      selectedId={selectedId}
      onSelect={onSelect}
      height={height}
    />
  );
}
