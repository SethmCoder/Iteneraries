import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
import { searchFlightMcpCache } from "@/lib/flights/flight-mcp-cache";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`flight-mcp:${userId}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: {
    origin?: string;
    destination?: string;
    departureDate?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const origin = body.origin?.trim() ?? "";
  const destination = body.destination?.trim() ?? "";
  const departureDate = body.departureDate?.trim() ?? "";
  if (origin.length !== 3 || destination.length !== 3 || !departureDate) {
    return NextResponse.json(
      { error: "origin, destination (IATA), and departureDate are required" },
      { status: 400 },
    );
  }

  const result = await searchFlightMcpCache({
    origin,
    destination,
    departureDate,
  });
  return NextResponse.json(result);
}
