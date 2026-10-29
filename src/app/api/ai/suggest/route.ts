import { NextResponse } from "next/server";
import { z } from "zod";
import {
  suggestItinerary,
  type SuggestPromptInput,
} from "@/lib/ai/suggest-itinerary";
import { scheduleTripDays } from "@/lib/itinerary/schedule-day";
import { isAiConfigured } from "@/lib/env";
import { resolveMany, type ResolvedPlace } from "@/lib/places/resolve";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId: z.string().uuid(),
  mustDos: z.array(z.string()).max(20).optional(),
  listIds: z.array(z.string().uuid()).max(20).optional(),
  pace: z.enum(["relaxed", "balanced", "packed", "moderate"]).optional(),
  requiredMustDos: z.array(z.string()).max(20).optional(),
  mode: z.enum(["full", "major", "lesser"]).optional(),
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

    const limited = rateLimit(`ai:${user.id}`, 5, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { tripId, pace, mode = "full" } = parsed.data;
    const listIds =
      mode === "major" ? [] : (parsed.data.listIds ?? []);
    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const profile = (trip.planning_profile ?? {}) as {
      mustDos?: string[];
    };
    const mustDoTexts = [
      ...(parsed.data.mustDos ?? []),
      ...(profile.mustDos ?? []),
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    const requiredSet = new Set(
      (parsed.data.requiredMustDos ?? mustDoTexts).map((s) => s.toLowerCase()),
    );

    const destination =
      trip.destination_name ||
      trip.name ||
      mustDoTexts[0]?.split(",")[0] ||
      "";
    if (!destination) {
      return NextResponse.json(
        { error: "Set a destination or Must-Dos before requesting suggestions." },
        { status: 400 },
      );
    }

    // Authorize & load places from selected lists
    const savedPlaces: ResolvedPlace[] = [];
    if (listIds.length) {
      const { data: accessible } = await supabase
        .from("place_lists")
        .select("id")
        .in("id", listIds);
      const okIds = new Set((accessible ?? []).map((l) => l.id as string));
      for (const id of listIds) {
        if (!okIds.has(id)) {
          return NextResponse.json(
            { error: "One or more lists are not accessible" },
            { status: 403 },
          );
        }
      }
      const { data: items } = await supabase
        .from("place_list_items")
        .select("*, places(*)")
        .in("list_id", listIds);
      for (const row of items ?? []) {
        const place = Array.isArray(row.places) ? row.places[0] : row.places;
        if (!place) continue;
        savedPlaces.push({
          name: place.name,
          address: place.address,
          lat: place.latitude,
          lon: place.longitude,
          osmType: place.osm_type,
          osmId: place.osm_id,
          category: place.category,
          openingHoursRaw: place.opening_hours_raw,
          hoursStatus: place.opening_hours_raw ? "verified" : "unknown",
          estimatedDurationMinutes: 90,
          durationIsEstimate: true,
          sourceQuery: place.name,
          relevance: "From selected Saved Places list",
        });
      }
    }

    const resolvedMust = await resolveMany(mustDoTexts, { destination });
    const unresolvedMust = mustDoTexts.filter(
      (m) =>
        !resolvedMust.some(
          (r) =>
            r.sourceQuery.toLowerCase() === m.toLowerCase() ||
            r.name.toLowerCase().includes(m.toLowerCase()),
        ),
    );

    const mustDosForSchedule =
      mode === "lesser"
        ? []
        : resolvedMust.map((r) => ({
            ...r,
            required: requiredSet.has(r.sourceQuery.toLowerCase()),
          }));

    const { data: existingItems } = await supabase
      .from("itinerary_items")
      .select("title, start_at, details")
      .eq("trip_id", tripId);

    const lockedTitles = (existingItems ?? [])
      .filter((i) => {
        const d = i.details as Record<string, unknown> | null;
        return Boolean(
          d &&
            (d.locked === true ||
              d.priority === "major" ||
              d.category === "must_do"),
        );
      })
      .map((i) => i.title as string);

    const scheduled = scheduleTripDays({
      destination,
      startDate: trip.start_date ?? undefined,
      endDate: trip.end_date ?? undefined,
      pace: pace ?? "balanced",
      mustDos: mustDosForSchedule,
      saved: mode === "major" ? [] : savedPlaces,
    });

    for (const u of unresolvedMust) {
      scheduled.excluded.push({
        title: u,
        reason: "Could not resolve to a real place via geocoding",
        sourceQuery: u,
      });
    }

    // Prefer AI when configured — constrained to candidate place names
    if (isAiConfigured()) {
      try {
        const candidateNames = [
          ...resolvedMust.map((r) => r.name),
          ...savedPlaces.map((r) => r.name),
        ];
        const aiInput: SuggestPromptInput = {
          destination,
          startDate: trip.start_date ?? undefined,
          endDate: trip.end_date ?? undefined,
          pace:
            pace === "balanced"
              ? "moderate"
              : pace === "relaxed" || pace === "packed"
                ? pace
                : "moderate",
          existingItems: existingItems ?? [],
          notes: [
            mustDoTexts.length
              ? `Must-Dos (schedule these if possible): ${mustDoTexts.join("; ")}`
              : "",
            candidateNames.length
              ? `Only schedule from these verified/saved places when possible: ${candidateNames.join("; ")}. You may add well-known meal placeholders labeled as unverified.`
              : "",
            lockedTitles.length
              ? `Preserve locked stops (do not reschedule): ${lockedTitles.join("; ")}`
              : "",
            "Assign startTime (HH:mm) and durationMinutes for a full day. Never invent opening hours.",
            scheduled.excluded.length
              ? `Already excluded: ${scheduled.excluded.map((e) => e.title).join("; ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        };
        const aiResult = await suggestItinerary(aiInput);

        await supabase.from("trip_suggestions").insert({
          trip_id: tripId,
          created_by: user.id,
          suggestion_data: { ...aiResult, excluded: scheduled.excluded },
          status: "pending",
        });

        return NextResponse.json({
          ...aiResult,
          excluded: scheduled.excluded,
          source: "ai",
        });
      } catch {
        // Fall through to deterministic schedule
      }
    }

    const days = scheduled.days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      items: d.items.map((i) => ({
        title: i.title,
        description: i.description,
        category: i.category,
        locationName: i.locationName,
        startTime: i.startTime,
        durationMinutes: i.durationMinutes,
        hoursStatus: i.hoursStatus,
        source: i.source,
        relevance: i.relevance,
        osmId: i.osmId,
        lat: i.lat,
        lon: i.lon,
      })),
    }));

    const result = {
      days,
      notes:
        "Scheduled from Must-Dos and Saved Places. Opening hours labeled when verified in OpenStreetMap; otherwise unverified.",
      excluded: scheduled.excluded,
      source: isAiConfigured() ? "deterministic_fallback" : "deterministic",
    };

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
