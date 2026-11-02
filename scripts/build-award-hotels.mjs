#!/usr/bin/env node
/**
 * Download open-hotel-data hotels.json and write a lean award-hotel catalog.
 * Source: https://github.com/kevchentw/open-hotel-data
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const SRC =
  "https://raw.githubusercontent.com/kevchentw/open-hotel-data/main/public/data/hotels.json";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function avgCashFromIprefer(prices) {
  if (!prices?.months || typeof prices.months !== "object") return null;
  const mins = [];
  for (const m of Object.values(prices.months)) {
    const c = num(m?.cash_min);
    if (c != null && c > 0) mins.push(c);
  }
  if (!mins.length) return null;
  return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
}

function avgPointsFromIprefer(prices) {
  if (!prices?.months || typeof prices.months !== "object") return null;
  const mins = [];
  for (const m of Object.values(prices.months)) {
    const p = num(m?.points_min);
    if (p != null && p > 0) mins.push(p);
  }
  if (!mins.length) return null;
  return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
}

function programsFor(h) {
  const out = [];
  if (h.amex_url) out.push("amex_fhr_thc");
  if (h.hilton_url || h.hilton_points_price || h.hilton_cash_price) {
    out.push("hilton");
  }
  if (h.chase_url || h.chase_2026_credit) out.push("chase_edit");
  if (h.bilt_url) out.push("bilt");
  if (h.iprefer_points || h.iprefer_prices) out.push("iprefer");
  // Aspire often overlaps Hilton; detect from plan-ish fields if present
  const blob = `${h.plan ?? ""} ${h.hilton_points_reward_type ?? ""}`.toLowerCase();
  if (blob.includes("aspire") || blob.includes("resort credit")) {
    if (!out.includes("hilton_aspire")) out.push("hilton_aspire");
  }
  return out;
}

function primaryUrl(h) {
  return (
    h.amex_url ||
    h.hilton_url ||
    h.chase_url ||
    h.bilt_url ||
    h.url ||
    null
  );
}

console.log("Fetching open-hotel-data hotels.json…");
const res = await fetch(SRC);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const raw = await res.json();
const hotels = Array.isArray(raw.hotels) ? raw.hotels : [];

const lean = [];
for (const h of hotels) {
  const lat = num(h.latitude);
  const lon = num(h.longitude);
  if (lat == null || lon == null) continue;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

  const avgCash =
    avgCashFromIprefer(h.iprefer_prices) ??
    num(h.hilton_cash_price) ??
    null;
  const avgPoints =
    avgPointsFromIprefer(h.iprefer_prices) ??
    num(String(h.hilton_points_price).replace(/[^\d.]/g, "")) ??
    null;

  const programs = programsFor(h);
  if (programs.length === 0) programs.push("other");

  lean.push({
    id: String(h.id),
    name: String(h.name || "Hotel").slice(0, 200),
    city: (h.city || "").toString().slice(0, 80) || null,
    country: (h.country || "").toString().slice(0, 80) || null,
    brand: (h.brand || h.chain || "").toString().slice(0, 80) || null,
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    programs,
    avgCashUsd: avgCash,
    avgPoints,
    url: primaryUrl(h),
  });
}

mkdirSync(DATA, { recursive: true });
const outPath = join(DATA, "award-hotels.lean.json");
writeFileSync(
  outPath,
  JSON.stringify({
    source: "https://github.com/kevchentw/open-hotel-data",
    generatedAt: new Date().toISOString(),
    count: lean.length,
    hotels: lean,
  }),
);
console.log(`Wrote ${lean.length} hotels → data/award-hotels.lean.json`);
