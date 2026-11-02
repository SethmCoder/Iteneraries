import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AiNotConfiguredError,
  AiRequestError,
  AiResponseError,
} from "@/lib/ai/client";
import { importItineraryFromText } from "@/lib/ai/import-itinerary";
import { isAiConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId: z.string().uuid(),
  text: z.string().min(8).max(20_000),
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

    if (!isAiConfigured()) {
      return NextResponse.json(
        {
          error:
            "AI is not configured. Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL and OPENAI_MODEL).",
        },
        { status: 503 },
      );
    }

    const limited = rateLimit(`ai-import:${user.id}`, 5, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide a tripId and pasted itinerary text (at least 8 characters)." },
        { status: 400 },
      );
    }

    const { tripId, text } = parsed.data;

    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    const isOwner = trip.owner_id === user.id;
    if (!isOwner && !membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: existingItems } = await supabase
      .from("itinerary_items")
      .select("title, start_at")
      .eq("trip_id", tripId);

    const result = await importItineraryFromText({
      pastedText: text,
      startDate: trip.start_date,
      endDate: trip.end_date,
      timezone: trip.timezone,
      destination: trip.destination_name ?? trip.name,
      tripName: trip.name,
      existingItems: existingItems ?? [],
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    if (e instanceof AiRequestError) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
    }
    if (e instanceof AiResponseError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: (e as Error).message || "Import parsing failed" },
      { status: 502 },
    );
  }
}
