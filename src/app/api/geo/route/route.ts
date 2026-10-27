import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/lib/auth-guard";
import { getRoute } from "@/lib/routing";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  from: z.object({ lat: z.number(), lon: z.number() }),
  to: z.object({ lat: z.number(), lon: z.number() }),
  mode: z.enum(["car", "walking", "bicycle", "transit"]),
});

export async function POST(request: Request) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`route:${userId}`, 40, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await getRoute(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Routing failed" },
      { status: 502 },
    );
  }
}
