import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
import {
  isGoogleHotelsConfigured,
  isHotelPriceEnrichmentConfigured,
} from "@/lib/env";
import { searchHotels } from "@/lib/hotels/search";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`hotel-search:${userId}`, 20, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    if (q.trim().length < 2) {
      return NextResponse.json({
        results: [],
        provider: isGoogleHotelsConfigured() ? "google" : "openstreetmap",
        pricesConfigured: isHotelPriceEnrichmentConfigured(),
      });
    }

    const results = await searchHotels(q, 20);
    const provider =
      results[0]?.source === "google"
        ? "google"
        : isGoogleHotelsConfigured()
          ? "google"
          : "openstreetmap";
    return NextResponse.json({
      results,
      provider: results.length ? results[0]?.source ?? provider : provider,
      pricesConfigured: isHotelPriceEnrichmentConfigured(),
      googleConfigured: isGoogleHotelsConfigured(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Hotel search failed" },
      { status: 502 },
    );
  }
}
