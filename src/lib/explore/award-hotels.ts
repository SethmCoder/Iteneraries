import raw from "../../../data/award-hotels.lean.json";

export type AwardHotelProgram =
  | "amex_fhr_thc"
  | "hilton"
  | "hilton_aspire"
  | "chase_edit"
  | "bilt"
  | "iprefer"
  | "other";

export type AwardHotel = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  brand: string | null;
  lat: number;
  lon: number;
  programs: string[];
  avgCashUsd: number | null;
  avgPoints: number | null;
  url: string | null;
};

export type AwardHotelCity = {
  key: string;
  city: string;
  country: string | null;
  lat: number;
  lon: number;
  hotelCount: number;
  avgCashUsd: number | null;
  avgPoints: number | null;
  programs: string[];
};

type LeanFile = {
  source: string;
  generatedAt: string;
  count: number;
  hotels: AwardHotel[];
};

const data = raw as LeanFile;

export function getAwardHotelsMeta() {
  return {
    source: data.source,
    generatedAt: data.generatedAt,
    count: data.count,
  };
}

export function allAwardHotels(): AwardHotel[] {
  return data.hotels;
}

export function searchAwardHotels(opts: {
  q?: string;
  program?: string;
  country?: string;
  city?: string;
  limit?: number;
}): AwardHotel[] {
  const q = opts.q?.trim().toLowerCase() ?? "";
  const program = opts.program?.trim().toLowerCase() ?? "";
  const country = opts.country?.trim().toLowerCase() ?? "";
  const city = opts.city?.trim().toLowerCase() ?? "";
  const limit = Math.min(500, Math.max(1, opts.limit ?? 120));

  const out: AwardHotel[] = [];
  for (const h of data.hotels) {
    if (program && !h.programs.some((p) => p.toLowerCase() === program)) {
      continue;
    }
    if (country && !(h.country ?? "").toLowerCase().includes(country)) {
      continue;
    }
    if (city && !(h.city ?? "").toLowerCase().includes(city)) {
      continue;
    }
    if (q) {
      const hay =
        `${h.name} ${h.city ?? ""} ${h.country ?? ""} ${h.brand ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

export function awardHotelCities(opts?: {
  program?: string;
  q?: string;
  limit?: number;
}): AwardHotelCity[] {
  const program = opts?.program?.trim().toLowerCase() ?? "";
  const q = opts?.q?.trim().toLowerCase() ?? "";
  const limit = Math.min(400, Math.max(1, opts?.limit ?? 200));

  type Acc = {
    city: string;
    country: string | null;
    latSum: number;
    lonSum: number;
    n: number;
    cash: number[];
    points: number[];
    programs: Set<string>;
  };
  const map = new Map<string, Acc>();

  for (const h of data.hotels) {
    if (!h.city) continue;
    if (program && !h.programs.some((p) => p.toLowerCase() === program)) {
      continue;
    }
    if (q) {
      const hay =
        `${h.name} ${h.city} ${h.country ?? ""} ${h.brand ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const key = `${h.city.toLowerCase()}|${(h.country ?? "").toLowerCase()}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        city: h.city,
        country: h.country,
        latSum: 0,
        lonSum: 0,
        n: 0,
        cash: [],
        points: [],
        programs: new Set(),
      };
      map.set(key, acc);
    }
    acc.latSum += h.lat;
    acc.lonSum += h.lon;
    acc.n += 1;
    if (h.avgCashUsd != null) acc.cash.push(h.avgCashUsd);
    if (h.avgPoints != null) acc.points.push(h.avgPoints);
    for (const p of h.programs) acc.programs.add(p);
  }

  const cities: AwardHotelCity[] = [...map.entries()]
    .map(([key, acc]) => ({
      key,
      city: acc.city,
      country: acc.country,
      lat: acc.latSum / acc.n,
      lon: acc.lonSum / acc.n,
      hotelCount: acc.n,
      avgCashUsd: acc.cash.length
        ? Math.round(acc.cash.reduce((a, b) => a + b, 0) / acc.cash.length)
        : null,
      avgPoints: acc.points.length
        ? Math.round(
            acc.points.reduce((a, b) => a + b, 0) / acc.points.length,
          )
        : null,
      programs: [...acc.programs],
    }))
    .sort((a, b) => b.hotelCount - a.hotelCount)
    .slice(0, limit);

  return cities;
}

export function formatAwardPriceLabel(h: {
  avgCashUsd: number | null;
  avgPoints: number | null;
}): string {
  if (h.avgCashUsd != null) return `$${h.avgCashUsd}`;
  if (h.avgPoints != null) {
    if (h.avgPoints >= 1000) return `${Math.round(h.avgPoints / 1000)}k pts`;
    return `${h.avgPoints} pts`;
  }
  return "Award";
}

export const AWARD_PROGRAM_LABELS: Record<string, string> = {
  amex_fhr_thc: "Amex FHR / THC",
  hilton: "Hilton Honors",
  hilton_aspire: "Hilton Aspire",
  chase_edit: "Chase Edit",
  bilt: "Bilt",
  iprefer: "iPrefer",
  other: "Other",
};
