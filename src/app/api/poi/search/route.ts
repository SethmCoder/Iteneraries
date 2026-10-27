import { NextResponse } from "next/server";
import { z } from "zod";
import { getPoisForViewport } from "@/lib/poi";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`poi:${user.id}`, 30, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await getPoisForViewport(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "POI lookup failed" },
      { status: 502 },
    );
  }
}
