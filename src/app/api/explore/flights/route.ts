import { NextResponse } from "next/server";
import { listFlightDestinations } from "@/lib/explore/flight-destinations";
import { createClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-config";
import { hasDemoSession } from "@/lib/demo";

export async function GET(request: Request) {
  try {
    if (!(isDemoModeEnabled() && (await hasDemoSession()))) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? "120");

    const destinations = listFlightDestinations({ origin, q, limit });
    return NextResponse.json({
      mode: "flights",
      origin: origin?.toUpperCase() || null,
      destinations,
      note: origin
        ? "Cash amounts are rough distance-based estimates, not live fares or award inventory."
        : "Pick an origin airport to see estimated average cash prices to destinations.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Explore flights failed" },
      { status: 500 },
    );
  }
}
