"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  MapPinned,
  Plane,
  Building2,
  Search,
} from "lucide-react";
import { ExploreMap, type ExploreMapMarker } from "@/components/explore/explore-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AWARD_PROGRAM_LABELS,
  formatAwardPriceLabel,
  type AwardHotel,
  type AwardHotelCity,
} from "@/lib/explore/award-hotels";
import {
  formatFlightPriceLabel,
  type FlightDestination,
} from "@/lib/explore/flight-destinations";
import { cn } from "@/lib/utils";

type Mode = "flights" | "hotels";

export function ExploreWorkspace() {
  const [mode, setMode] = useState<Mode>("hotels");
  const [q, setQ] = useState("");
  const [program, setProgram] = useState("");
  const [origin, setOrigin] = useState("JFK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [metaSource, setMetaSource] = useState<string | null>(null);

  const [cities, setCities] = useState<AwardHotelCity[]>([]);
  const [hotels, setHotels] = useState<AwardHotel[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<FlightDestination[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadHotels = useCallback(
    async (opts?: { city?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (opts?.city) {
          params.set("mode", "hotels");
          params.set("city", opts.city);
          params.set("limit", "80");
        } else {
          params.set("mode", "cities");
          params.set("limit", "180");
        }
        if (q.trim()) params.set("q", q.trim());
        if (program) params.set("program", program);

        const res = await fetch(`/api/explore/hotels?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load hotels");

        setMetaSource(data.meta?.source ?? null);
        if (opts?.city) {
          setHotels(data.hotels ?? []);
          setSelectedCity(opts.city);
        } else {
          setCities(data.cities ?? []);
          setHotels([]);
          setSelectedCity(null);
        }
        setNote(
          "Award hotels from open-hotel-data (Amex / Hilton / Chase / iPrefer / Bilt). Prices are sampled averages when available.",
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [q, program],
  );

  const loadFlights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (origin.trim()) params.set("origin", origin.trim());
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "150");
      const res = await fetch(`/api/explore/flights?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load flights");
      setDestinations(data.destinations ?? []);
      setNote(data.note ?? null);
      setMetaSource(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [origin, q]);

  useEffect(() => {
    if (mode === "hotels") void loadHotels();
    else void loadFlights();
    setSelectedId(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- initial / mode switch only

  function runSearch() {
    if (mode === "hotels") void loadHotels(selectedCity ? { city: selectedCity } : undefined);
    else void loadFlights();
  }

  const markers: ExploreMapMarker[] = useMemo(() => {
    if (mode === "flights") {
      return destinations.map((d) => ({
        id: d.code,
        lat: d.lat,
        lon: d.lon,
        label: formatFlightPriceLabel(d),
        title: `${d.city} (${d.code})`,
        subtitle: `${d.country} · ${d.routeCount} route${d.routeCount === 1 ? "" : "s"}${
          d.distanceMi != null ? ` · ${d.distanceMi} mi` : ""
        }`,
      }));
    }
    if (hotels.length) {
      return hotels.map((h) => ({
        id: h.id,
        lat: h.lat,
        lon: h.lon,
        label: formatAwardPriceLabel(h),
        title: h.name,
        subtitle: [h.city, h.country].filter(Boolean).join(", "),
      }));
    }
    return cities.map((c) => ({
      id: c.key,
      lat: c.lat,
      lon: c.lon,
      label:
        c.avgCashUsd != null
          ? `$${c.avgCashUsd}`
          : c.avgPoints != null
            ? `${Math.round(c.avgPoints / 1000)}k`
            : `${c.hotelCount}`,
      title: c.city,
      subtitle: `${c.country ?? ""} · ${c.hotelCount} award hotel${
        c.hotelCount === 1 ? "" : "s"
      }`.trim(),
    }));
  }, [mode, destinations, hotels, cities]);

  const listItems = mode === "flights" ? destinations : hotels.length ? hotels : cities;

  return (
    <div className="-mx-3 flex min-h-[calc(100vh-8rem)] flex-col gap-3 sm:-mx-4 md:-mx-6">
      <div className="px-3 sm:px-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Award Explorer
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Daydream-style world map for award hotels and rough average flight
              cash estimates. Switch modes, filter, then drill into a city or
              destination.
            </p>
          </div>
          <div
            className="inline-flex rounded-[10px] border border-border bg-card p-1 shadow-sm"
            role="tablist"
            aria-label="Explore mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "flights"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors",
                mode === "flights"
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-brand-light hover:text-brand",
              )}
              onClick={() => setMode("flights")}
            >
              <Plane className="h-4 w-4" />
              Flights
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "hotels"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors",
                mode === "hotels"
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-brand-light hover:text-brand",
              )}
              onClick={() => setMode("hotels")}
            >
              <Building2 className="h-4 w-4" />
              Hotels
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[12px] border border-border bg-card p-3 shadow-sm">
          {mode === "flights" ? (
            <div className="space-y-1">
              <Label htmlFor="explore-origin" className="text-xs">
                From airport
              </Label>
              <Input
                id="explore-origin"
                className="w-[7.5rem] uppercase"
                value={origin}
                maxLength={3}
                placeholder="JFK"
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="explore-program" className="text-xs">
                Program
              </Label>
              <select
                id="explore-program"
                className="flex h-10 rounded-[8px] border border-input bg-white px-3 text-sm"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">All programs</option>
                {Object.entries(AWARD_PROGRAM_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="explore-q" className="text-xs">
              Search
            </Label>
            <Input
              id="explore-q"
              value={q}
              placeholder={
                mode === "flights"
                  ? "City, airport, country…"
                  : "Hotel, city, brand…"
              }
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
            />
          </div>
          <Button type="button" onClick={runSearch} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
          {mode === "hotels" && selectedCity ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadHotels()}
            >
              All cities
            </Button>
          ) : null}
        </div>

        {note ? (
          <p className="mt-2 text-xs text-muted">
            {note}
            {metaSource ? (
              <>
                {" "}
                Source:{" "}
                <a
                  className="underline"
                  href={metaSource}
                  target="_blank"
                  rel="noreferrer"
                >
                  open-hotel-data
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 px-3 sm:px-4 md:grid-cols-[minmax(0,22rem)_1fr] md:px-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <aside className="flex max-h-[40vh] flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-sm md:max-h-[calc(100vh-14rem)]">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">
            {mode === "flights"
              ? `${destinations.length} destinations`
              : hotels.length
                ? `${hotels.length} hotels${selectedCity ? ` in ${selectedCity}` : ""}`
                : `${cities.length} cities`}
          </div>
          <ul className="flex-1 space-y-1 overflow-y-auto p-2">
            {mode === "flights"
              ? destinations.map((d) => (
                  <li key={d.code}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-brand-light",
                        selectedId === d.code && "bg-brand-light",
                      )}
                      onClick={() => setSelectedId(d.code)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {d.city}{" "}
                            <span className="font-normal text-muted">
                              ({d.code})
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted">
                            {d.country}
                            {d.distanceMi != null
                              ? ` · ${d.distanceMi.toLocaleString()} mi`
                              : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-brand">
                          {formatFlightPriceLabel(d)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))
              : hotels.length
                ? hotels.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-brand-light",
                          selectedId === h.id && "bg-brand-light",
                        )}
                        onClick={() => setSelectedId(h.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {h.name}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {[h.city, h.country].filter(Boolean).join(", ")}
                              {h.brand ? ` · ${h.brand}` : ""}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted">
                              {h.programs
                                .map((p) => AWARD_PROGRAM_LABELS[p] ?? p)
                                .join(" · ")}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-brand">
                            {formatAwardPriceLabel(h)}
                          </span>
                        </div>
                        {h.url ? (
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Book / details
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </button>
                    </li>
                  ))
                : cities.map((c) => (
                    <li key={c.key}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-brand-light",
                          selectedId === c.key && "bg-brand-light",
                        )}
                        onClick={() => {
                          setSelectedId(c.key);
                          void loadHotels({ city: c.city });
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {c.city}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {c.country} · {c.hotelCount} hotels
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-brand">
                            {c.avgCashUsd != null
                              ? `$${c.avgCashUsd}`
                              : formatAwardPriceLabel(c)}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
            {!loading && listItems.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted">
                No results. Try another search.
              </li>
            ) : null}
          </ul>
          <div className="border-t border-border p-2">
            <Button variant="secondary" size="sm" className="w-full" asChild>
              <Link href={mode === "flights" ? "/flights" : "/hotels"}>
                <MapPinned className="h-3.5 w-3.5" />
                Open {mode === "flights" ? "Flights" : "Hotels"} Pending
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </Link>
            </Button>
          </div>
        </aside>

        <section className="min-h-[min(55vh,28rem)] md:min-h-[calc(100vh-14rem)]">
          <ExploreMap
            markers={markers}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              if (mode === "hotels" && !hotels.length) {
                const city = cities.find((c) => c.key === id);
                if (city) void loadHotels({ city: city.city });
              }
            }}
            height="100%"
          />
        </section>
      </div>
    </div>
  );
}
