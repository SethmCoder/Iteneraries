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
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PoiCategory, PoiPlace } from "@/lib/poi/types";
import { POI_CATEGORIES, shouldFetchPois } from "@/lib/poi/zoom-config";

export type MapItineraryPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  href?: string;
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
    html: `<div class="waypoint-itinerary-marker${selected ? " selected" : ""}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

function categoryGlyph(category: PoiCategory): string {
  const color = "#1616C9";
  const icons: Record<PoiCategory, string> = {
    attractions: "▲",
    museums: "M",
    restaurants: "🍴",
    cafes: "☕",
    parks: "🌳",
    historic: "🏛",
    shopping: "🛍",
  };
  return `<div class="waypoint-poi-marker" style="color:${color}">${icons[category] ?? "•"}</div>`;
}

function poiIcon(category: PoiCategory) {
  return L.divIcon({
    className: "",
    html: categoryGlyph(category),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function PoiLayer({
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
  const [addingId, setAddingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const map = useMap();

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
        return;
      }
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
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load places");
        }
        const data = (await res.json()) as { places: PoiPlace[] };
        setPlaces(data.places ?? []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "Places unavailable");
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [enabled, map, activeCategories, refreshKey]);

  const visible = places.filter(
    (p) => !itineraryOsmIds.has(`${p.osmType}/${p.osmId}`),
  );

  return (
    <>
      {loading ? (
        <div className="pointer-events-none absolute right-3 top-14 z-[450] flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2 py-1 text-xs text-muted shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading places…
        </div>
      ) : null}
      {error ? (
        <div className="absolute right-3 top-14 z-[450] max-w-[220px] rounded-[8px] border border-border bg-card px-2 py-1 text-xs text-destructive shadow-sm">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      {visible.slice(0, 200).map((place) => (
        <Marker
          key={`${place.osmType}/${place.osmId}`}
          position={[place.lat, place.lon]}
          icon={poiIcon(place.category)}
        >
          <Popup>
            <div className="min-w-[180px] space-y-2 font-[family-name:var(--font-inter)]">
              <div>
                <p className="font-semibold text-sm text-[#1F2937]">{place.name}</p>
                <p className="text-xs capitalize text-[#6B7280]">{place.category}</p>
                {place.address ? (
                  <p className="text-xs text-[#6B7280]">{place.address}</p>
                ) : null}
              </div>
              {onAddPoi && tripId ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={addingId === `${place.osmType}/${place.osmId}`}
                  onClick={async () => {
                    const key = `${place.osmType}/${place.osmId}`;
                    setAddingId(key);
                    try {
                      await onAddPoi(place);
                    } finally {
                      setAddingId(null);
                    }
                  }}
                >
                  {addingId === `${place.osmType}/${place.osmId}`
                    ? "Adding…"
                    : "Add to Itinerary"}
                </Button>
              ) : (
                <p className="text-xs text-[#6B7280]">
                  Open a trip to add this place.
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

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

  const itineraryOsmIds = useMemo(() => new Set<string>(), []);
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
              color: isSatellite ? "#EEEEFF" : "#1616C9",
              weight: isSatellite ? 6 : 5,
              opacity: 0.9,
              lineJoin: "round",
              lineCap: "round",
            }}
          >
            {route.label ? (
              <Popup>
                <p className="text-sm font-medium text-[#1F2937]">{route.label}</p>
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
                  <Link href={pin.href} className="text-xs font-medium text-[#1616C9]">
                    Open itinerary
                  </Link>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
        {enablePoi ? (
          <PoiLayer
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
