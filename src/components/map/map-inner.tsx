"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PoiClusterLayer } from "@/components/map/poi-cluster-layer";
import type { PoiCategory, PoiPlace } from "@/lib/poi/types";
import { POI_CATEGORIES } from "@/lib/poi/zoom-config";

export type MapItineraryPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  href?: string;
  /** OSM id like "node/123" used to hide duplicate POI markers */
  osmId?: string | null;
};

export type MapRouteSegment = {
  id: string;
  positions: Array<[number, number]>;
  label?: string;
};

type WaypointMapProps = {
  pins: MapItineraryPin[];
  selectedPinId?: string | null;
  onSelectPin?: (id: string) => void;
  tripId?: string | null;
  onAddPoi?: (place: PoiPlace) => Promise<void> | void;
  enablePoi?: boolean;
  routes?: MapRouteSegment[];
  className?: string;
  height?: string;
};

const itineraryIcon = (selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="waypoint-itinerary-marker${selected ? " selected" : ""}" title="Itinerary stop"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

function FitBounds({
  pins,
  routes = [],
}: {
  pins: MapItineraryPin[];
  routes?: MapRouteSegment[];
}) {
  const map = useMap();
  useEffect(() => {
    const points: Array<[number, number]> = [
      ...pins.map((p) => [p.lat, p.lng] as [number, number]),
      ...routes.flatMap((r) => r.positions),
    ];
    if (!points.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.2));
  }, [map, pins, routes]);
  return null;
}

function CenterOnSelected({
  pins,
  selectedPinId,
}: {
  pins: MapItineraryPin[];
  selectedPinId?: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedPinId) return;
    const pin = pins.find((p) => p.id === selectedPinId);
    if (pin) map.panTo([pin.lat, pin.lng]);
  }, [map, pins, selectedPinId]);
  return null;
}

const CATEGORY_FILTERS: { id: PoiCategory; label: string }[] = [
  { id: "attractions", label: "Attractions" },
  { id: "museums", label: "Museums" },
  { id: "restaurants", label: "Restaurants" },
  { id: "cafes", label: "Cafes" },
  { id: "parks", label: "Parks" },
  { id: "historic", label: "Historic" },
  { id: "shopping", label: "Shopping" },
];

function SearchAndFly({
  onFly,
}: {
  onFly: (lat: number, lon: number, label: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { display_name: string; lat: number; lon: number; name?: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const query = q.trim();
    if (query.length < 2) {
      setError("Enter at least 2 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/geo/search?q=${encodeURIComponent(query)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }
      const next = (data.results ?? []) as Array<{
        display_name: string;
        lat: number;
        lon: number;
        name?: string;
      }>;
      setResults(next);
      setOpen(true);
      if (next.length === 0) {
        setError("No places found. Try a more specific name.");
      }
    } catch (e) {
      setResults([]);
      setOpen(false);
      setError((e as Error).message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute left-3 top-3 z-[450] w-[min(calc(100%-7.5rem),260px)]">
      <div className="flex gap-1">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder="Search places…"
          className="bg-card shadow-sm"
        />
        <Button
          type="button"
          size="sm"
          disabled={loading}
          onClick={() => void search()}
        >
          {loading ? "…" : "Go"}
        </Button>
      </div>
      {error ? (
        <p className="mt-1 rounded-[8px] border border-border bg-card px-2 py-1 text-[11px] text-destructive shadow-sm">
          {error}
        </p>
      ) : null}
      {open && results.length > 0 ? (
        <ul className="mt-1 max-h-48 overflow-auto rounded-[8px] border border-border bg-card shadow-md">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon},${r.display_name}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-brand-light"
                onClick={() => {
                  onFly(Number(r.lat), Number(r.lon), r.display_name);
                  setOpen(false);
                  setError(null);
                  setQ(r.name || r.display_name);
                }}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FlyToController({
  target,
}: {
  target: { lat: number; lon: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], 14);
  }, [map, target]);
  return null;
}

type MapBaseLayer = "streets" | "satellite";

const BASE_LAYERS: Record<
  MapBaseLayer,
  { url: string; attribution: string; maxZoom?: number }
> = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
};

export default function MapInner({
  pins,
  selectedPinId,
  onSelectPin,
  tripId,
  onAddPoi,
  enablePoi = true,
  routes = [],
  className,
  height = "100%",
}: WaypointMapProps) {
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [categories, setCategories] = useState<PoiCategory[]>([
    ...POI_CATEGORIES,
  ]);
  const [baseLayer, setBaseLayer] = useState<MapBaseLayer>("streets");

  const itineraryOsmIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pin of pins) {
      if (pin.osmId) ids.add(pin.osmId);
    }
    return ids;
  }, [pins]);
  const tiles = BASE_LAYERS[baseLayer];
  const isSatellite = baseLayer === "satellite";

  function toggleCategory(cat: PoiCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  return (
    <div
      className={`relative z-0 isolate overflow-hidden rounded-[12px] border border-border ${className ?? ""}`}
      style={{ height, minHeight: 320 }}
    >
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          key={baseLayer}
          attribution={tiles.attribution}
          url={tiles.url}
          maxZoom={tiles.maxZoom}
        />
        <FitBounds pins={pins} routes={routes} />
        <CenterOnSelected pins={pins} selectedPinId={selectedPinId} />
        <FlyToController target={flyTarget} />
        {routes.map((route) => (
          <Polyline
            key={`${route.id}-${baseLayer}`}
            positions={route.positions}
            pathOptions={{
              color: isSatellite ? "#DDF1F2" : "#176B87",
              weight: isSatellite ? 6 : 5,
              opacity: 0.9,
              lineJoin: "round",
              lineCap: "round",
            }}
          >
            {route.label ? (
              <Popup>
                <p className="text-sm font-medium text-foreground">{route.label}</p>
              </Popup>
            ) : null}
          </Polyline>
        ))}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={itineraryIcon(pin.id === selectedPinId)}
            eventHandlers={{
              click: () => onSelectPin?.(pin.id),
            }}
          >
            <Popup>
              <div className="space-y-1 font-[family-name:var(--font-inter)]">
                <p className="font-semibold text-sm">{pin.title}</p>
                {pin.subtitle ? (
                  <p className="text-xs text-[#6B7280]">{pin.subtitle}</p>
                ) : null}
                {pin.href ? (
                  <Link href={pin.href} className="text-xs font-medium text-brand">
                    Open itinerary
                  </Link>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
        {enablePoi ? (
          <PoiClusterLayer
            enabled={enablePoi}
            tripId={tripId}
            itineraryOsmIds={itineraryOsmIds}
            onAddPoi={onAddPoi}
            activeCategories={categories}
          />
        ) : null}
      </MapContainer>
      <SearchAndFly
        onFly={(lat, lon) => setFlyTarget({ lat, lon })}
      />
      <div className="absolute right-3 top-3 z-[450] flex items-center rounded-[8px] border border-border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setBaseLayer("streets")}
          className={`rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
            baseLayer === "streets"
              ? "bg-brand text-white"
              : "text-muted hover:bg-brand-light hover:text-brand"
          }`}
          aria-pressed={baseLayer === "streets"}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setBaseLayer("satellite")}
          className={`rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
            baseLayer === "satellite"
              ? "bg-brand text-white"
              : "text-muted hover:bg-brand-light hover:text-brand"
          }`}
          aria-pressed={baseLayer === "satellite"}
        >
          Satellite
        </button>
      </div>
      {enablePoi ? (
        <div className="absolute bottom-3 left-3 right-3 z-[450] flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              className={`rounded-[8px] border px-2 py-1 text-[11px] font-medium shadow-sm transition-colors duration-150 ${
                categories.includes(c.id)
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-card text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
