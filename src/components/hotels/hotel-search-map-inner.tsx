"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { HotelSearchResult } from "@/lib/hotels/types";

function priceIcon(label: string, selected: boolean) {
  const safe = label.replace(/[<>&"]/g, "");
  return L.divIcon({
    className: "",
    html: `<div class="hotel-price-marker${selected ? " selected" : ""}">${safe}</div>`,
    iconSize: [56, 28],
    iconAnchor: [28, 28],
  });
}

function FitHotels({ hotels }: { hotels: HotelSearchResult[] }) {
  const map = useMap();
  useEffect(() => {
    if (!hotels.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (hotels.length === 1) {
      map.setView([hotels[0]!.lat, hotels[0]!.lon], 13);
      return;
    }
    const bounds = L.latLngBounds(hotels.map((h) => [h.lat, h.lon] as [number, number]));
    map.fitBounds(bounds.pad(0.25));
  }, [map, hotels]);
  return null;
}

export default function HotelSearchMapInner({
  hotels,
  selectedId,
  onSelect,
  height = "280px",
}: {
  hotels: HotelSearchResult[];
  selectedId?: string | null;
  onSelect?: (hotel: HotelSearchResult) => void;
  height?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border" style={{ height }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitHotels hotels={hotels} />
        {hotels.map((h) => (
          <Marker
            key={h.id}
            position={[h.lat, h.lon]}
            icon={priceIcon(h.priceLabel, selectedId === h.id)}
            eventHandlers={{
              click: () => onSelect?.(h),
            }}
          >
            <Popup>
              <div className="max-w-[200px] text-sm">
                {h.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.photoUrl}
                    alt=""
                    className="mb-2 h-24 w-full rounded object-cover"
                  />
                ) : null}
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-muted">{h.location}</p>
                <p className="mt-1 text-xs">
                  {h.averagePriceUsd != null
                    ? `Avg sample ~$${h.averagePriceUsd}/night`
                    : h.source === "google"
                      ? `${h.priceLabel}${h.rating != null ? ` · ${h.rating.toFixed(1)}★` : ""}`
                      : "OpenStreetMap location · check OTA for rates"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
