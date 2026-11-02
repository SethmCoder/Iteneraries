"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ExploreMapMarker } from "./explore-map";

function priceIcon(label: string, selected: boolean) {
  const safe = label.replace(/[<>&"]/g, "");
  return L.divIcon({
    className: "",
    html: `<div class="hotel-price-marker${selected ? " selected" : ""}">${safe}</div>`,
    iconSize: [64, 28],
    iconAnchor: [32, 28],
  });
}

function FitMarkers({ markers }: { markers: ExploreMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lon], 6);
      return;
    }
    const bounds = L.latLngBounds(
      markers.map((m) => [m.lat, m.lon] as [number, number]),
    );
    map.fitBounds(bounds.pad(0.2));
  }, [map, markers]);
  return null;
}

export default function ExploreMapInner({
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
    <div
      className="overflow-hidden rounded-[12px] border border-border"
      style={{ height }}
    >
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full w-full"
        scrollWheelZoom
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMarkers markers={markers} />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lon]}
            icon={priceIcon(m.label, selectedId === m.id)}
            eventHandlers={{
              click: () => onSelect?.(m.id),
            }}
          >
            <Popup>
              <div className="max-w-[220px] text-sm">
                <p className="font-semibold">{m.title}</p>
                {m.subtitle ? (
                  <p className="text-xs text-muted">{m.subtitle}</p>
                ) : null}
                <p className="mt-1 text-xs font-medium">{m.label}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
