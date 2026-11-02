import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
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
        provider: "openstreetmap",
      });
    }

    const results = await searchHotels(q, 20);
    return NextResponse.json({
      results,
      provider: "openstreetmap",
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Hotel search failed" },
      { status: 502 },
    );
  }
}
