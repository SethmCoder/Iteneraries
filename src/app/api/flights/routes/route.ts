import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
import { searchRoutes } from "@/lib/flights/openflights-routes";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const userId = await getRequestUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`routes:${userId}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  return NextResponse.json({ results: searchRoutes(from, to, 20) });
}
