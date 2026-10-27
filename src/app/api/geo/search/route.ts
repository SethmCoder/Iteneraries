import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
import { searchPlaces } from "@/lib/geo/nominatim";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`geo:${userId}`, 20, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const results = await searchPlaces(q);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Search failed" },
      { status: 502 },
    );
  }
}
