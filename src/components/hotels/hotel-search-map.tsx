"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const HotelSearchMapInner = dynamic(() => import("./hotel-search-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-[10px] border border-border bg-[var(--page-bg)] text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function HotelSearchMap(
  props: ComponentProps<typeof HotelSearchMapInner>,
) {
  return <HotelSearchMapInner {...props} />;
}
