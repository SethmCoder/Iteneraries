import { NextResponse } from "next/server";
import {
  awardHotelCities,
  getAwardHotelsMeta,
  searchAwardHotels,
} from "@/lib/explore/award-hotels";
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
    const mode = searchParams.get("mode") === "hotels" ? "hotels" : "cities";
    const q = searchParams.get("q") ?? undefined;
    const program = searchParams.get("program") ?? undefined;
    const city = searchParams.get("city") ?? undefined;
    const country = searchParams.get("country") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? "120");

    const meta = getAwardHotelsMeta();

    if (mode === "hotels") {
      const hotels = searchAwardHotels({ q, program, city, country, limit });
      return NextResponse.json({ meta, mode: "hotels", hotels });
    }

    const cities = awardHotelCities({ q, program, limit });
    return NextResponse.json({ meta, mode: "cities", cities });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Explore hotels failed" },
      { status: 500 },
    );
  }
}
