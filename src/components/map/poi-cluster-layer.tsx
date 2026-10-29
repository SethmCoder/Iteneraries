"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { Loader2 } from "lucide-react";
import type { PoiCategory, PoiPlace } from "@/lib/poi/types";
import { shouldFetchPois } from "@/lib/poi/zoom-config";

const POI_ICONS: Record<PoiCategory, L.DivIcon> = {
  attractions: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">▲</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  museums: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">M</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  restaurants: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">🍴</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  cafes: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">☕</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  parks: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">🌳</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  historic: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">🏛</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  shopping: L.divIcon({
    className: "",
    html: `<div class="waypoint-poi-marker" style="color:#1616C9">🛍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
};

function boundsKey(map: L.Map): string {
  const b = map.getBounds();
  const z = Math.round(map.getZoom());
  return [
    z,
    b.getSouth().toFixed(3),
    b.getWest().toFixed(3),
    b.getNorth().toFixed(3),
    b.getEast().toFixed(3),
  ].join("|");
}

export function PoiClusterLayer({
  enabled,
  tripId,
  itineraryOsmIds,
  onAddPoi,
  activeCategories,
}: {
  enabled: boolean;
  tripId?: string | null;
  itineraryOsmIds: Set<string>;
  onAddPoi?: (place: PoiPlace) => Promise<void> | void;
  activeCategories: PoiCategory[];
}) {
  const [places, setPlaces] = useState<PoiPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastBoundsKey = useRef("");
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useMapEvents({
    zoomend: () => setRefreshKey((k) => k + 1),
    moveend: () => setRefreshKey((k) => k + 1),
  });

  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(async () => {
      const zoom = map.getZoom();
      if (!shouldFetchPois(zoom)) {
        setPlaces([]);
        setFromCache(false);
        return;
      }
      const key = boundsKey(map);
      if (key === lastBoundsKey.current && places.length > 0) return;
      lastBoundsKey.current = key;

      const b = map.getBounds();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/poi/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            south: b.getSouth(),
            west: b.getWest(),
            north: b.getNorth(),
            east: b.getEast(),
            zoom,
            categories: activeCategories,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status === 499) return;
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error || "Failed to load places",
          );
        }
        const data = (await res.json()) as {
          places: PoiPlace[];
          fromCache?: boolean;
        };
        setPlaces(data.places ?? []);
        setFromCache(Boolean(data.fromCache));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "Places unavailable");
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- places length only gates skip
  }, [enabled, map, activeCategories, refreshKey]);

  const visible = useMemo(
    () =>
      places.filter(
        (p) => !itineraryOsmIds.has(`${p.osmType}/${p.osmId}`),
      ),
    [places, itineraryOsmIds],
  );

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    if (!enabled || visible.length === 0) return;

    const group = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
    });

    for (const place of visible.slice(0, 200)) {
      const marker = L.marker([place.lat, place.lon], {
        icon: POI_ICONS[place.category] ?? POI_ICONS.attractions,
      });
      const key = `${place.osmType}/${place.osmId}`;
      const container = document.createElement("div");
      container.className = "min-w-[180px] space-y-2 font-sans";
      container.innerHTML = `
        <div>
          <p class="font-semibold text-sm text-[#1F2937]"></p>
          <p class="text-xs capitalize text-[#6B7280]"></p>
          ${place.address ? `<p class="text-xs text-[#6B7280]"></p>` : ""}
        </div>
        <div data-action></div>
      `;
      const title = container.querySelector("p.font-semibold");
      if (title) title.textContent = place.name;
      const cat = container.querySelector("p.capitalize");
      if (cat) cat.textContent = place.category;
      if (place.address) {
        const addr = container.querySelectorAll("p.text-xs")[1];
        if (addr) addr.textContent = place.address;
      }
      const action = container.querySelector("[data-action]");
      if (action && onAddPoi && tripId) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "inline-flex h-8 w-full items-center justify-center rounded-[8px] bg-[#1616C9] px-3 text-xs font-semibold text-white";
        btn.textContent = "Add to Itinerary";
        btn.addEventListener("click", async () => {
          setAddingId(key);
          btn.textContent = "Adding…";
          btn.setAttribute("disabled", "true");
          try {
            await onAddPoi(place);
          } finally {
            setAddingId(null);
            btn.textContent = "Add to Itinerary";
            btn.removeAttribute("disabled");
          }
        });
        action.appendChild(btn);
      } else if (action) {
        const hint = document.createElement("p");
        hint.className = "text-xs text-[#6B7280]";
        hint.textContent = "Open a trip to add this place.";
        action.appendChild(hint);
      }
      marker.bindPopup(container);
      group.addLayer(marker);
    }

    map.addLayer(group);
    clusterRef.current = group;
    return () => {
      map.removeLayer(group);
      if (clusterRef.current === group) clusterRef.current = null;
    };
  }, [enabled, visible, map, onAddPoi, tripId, addingId]);

  return (
    <>
      {loading ? (
        <div className="pointer-events-none absolute right-3 top-14 z-[450] flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2 py-1 text-xs text-muted shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading places…
        </div>
      ) : fromCache && visible.length > 0 ? (
        <div className="pointer-events-none absolute right-3 top-14 z-[450] rounded-[8px] border border-border bg-card px-2 py-1 text-[11px] text-muted shadow-sm">
          Cached places
        </div>
      ) : null}
      {error ? (
        <div className="absolute right-3 top-14 z-[450] max-w-[220px] rounded-[8px] border border-border bg-card px-2 py-1 text-xs text-destructive shadow-sm">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              lastBoundsKey.current = "";
              setRefreshKey((k) => k + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
      {!loading && !error && enabled && shouldFetchPois(map.getZoom()) && visible.length === 0 ? (
        <div className="pointer-events-none absolute right-3 top-14 z-[450] max-w-[200px] rounded-[8px] border border-border bg-card px-2 py-1 text-[11px] text-muted shadow-sm">
          No places in this view. Zoom in or change filters.
        </div>
      ) : null}
    </>
  );
}
