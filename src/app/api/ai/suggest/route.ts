import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestItinerary } from "@/lib/ai/suggest-itinerary";
import { isAiConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ tripId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json(
        {
          error:
            "AI suggestions require OPENAI_API_KEY. Add it to .env.local and restart.",
        },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`ai:${user.id}`, 5, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { tripId } = parsed.data;
    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (!trip.destination_name) {
      return NextResponse.json(
        { error: "Set a destination before requesting suggestions." },
        { status: 400 },
      );
    }

    const { data: items } = await supabase
      .from("itinerary_items")
      .select("title, start_at")
      .eq("trip_id", tripId);

    const { data: otherTrips } = await supabase
      .from("trips")
      .select("destination_name, status")
      .neq("id", tripId)
      .limit(10);

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const result = await suggestItinerary({
      destination: trip.destination_name,
      startDate: trip.start_date ?? undefined,
      endDate: trip.end_date ?? undefined,
      existingItems: items ?? [],
      otherTrips: otherTrips ?? [],
      preferences: prefs
        ? {
            travel_pace: prefs.travel_pace,
            interests: prefs.interests,
            preferred_transport_modes: prefs.preferred_transport_modes,
          }
        : undefined,
      interests: prefs?.interests ?? undefined,
      pace: prefs?.travel_pace ?? undefined,
    });

    await supabase.from("trip_suggestions").insert({
      trip_id: tripId,
      created_by: user.id,
      suggestion_data: result,
      status: "pending",
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Suggestion failed" },
      { status: 502 },
    );
  }
}
