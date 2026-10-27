export type TransportMode = "car" | "walking" | "bicycle" | "transit";

export type LatLon = { lat: number; lon: number };

export type RouteRequest = {
  from: LatLon;
  to: LatLon;
  mode: TransportMode;
  /** Local wall-clock departure time, "YYYY-MM-DDTHH:mm". Used by transit only. */
  departAt?: string;
  signal?: AbortSignal;
};

export type RouteOk = {
  ok: true;
  mode: TransportMode;
  distanceMeters: number;
  durationSeconds: number;
  /** Route polyline as [lat, lon] pairs (Leaflet order). May be empty. */
  geometry: Array<[number, number]>;
  /** Which backend produced the result. */
  provider: "osrm" | "transit";
};

export type RouteUnavailable = {
  ok: false;
  mode: TransportMode;
  unavailableReason: string;
  /** True when the UI should offer manual duration entry. */
  isManualSuggested: boolean;
};

export type RouteResult = RouteOk | RouteUnavailable;
