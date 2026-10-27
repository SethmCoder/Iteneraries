import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
import { searchAirports } from "@/lib/flights/airports";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const userId = await getRequestUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`airports:${userId}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  // Static local dataset — keeps autocomplete available without a network geocoder.
  return NextResponse.json({ results: searchAirports(q, 8) });
}
