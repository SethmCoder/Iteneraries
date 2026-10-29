import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/lib/auth-guard";
import { getPoisForViewport } from "@/lib/poi";
import { rateLimit } from "@/lib/rate-limit";

const categorySchema = z.enum([
  "attractions",
  "museums",
  "restaurants",
  "cafes",
  "parks",
  "historic",
  "shopping",
]);

const bodySchema = z.object({
  south: z.number(),
  west: z.number(),
  north: z.number(),
  east: z.number(),
  zoom: z.number().min(0).max(22),
  categories: z.array(categorySchema).optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`poi:${userId}`, 30, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await getPoisForViewport({
      ...parsed.data,
      signal: request.signal,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (
      request.signal.aborted ||
      (e instanceof Error && e.name === "AbortError")
    ) {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      { error: (e as Error).message || "POI lookup failed" },
      { status: 502 },
    );
  }
}
