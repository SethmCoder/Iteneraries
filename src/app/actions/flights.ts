"use server";

import { revalidatePath } from "next/cache";
import { isAwardSearchConfigured } from "@/lib/env";
import {
  executeAwardSearch,
  notifyAwardMatches,
  persistAwardResults,
} from "@/lib/flights/run-search";
import {
  awardSearchFormSchema,
  loyaltyBalanceSchema,
} from "@/lib/flights/schema";
import { createClient } from "@/lib/supabase/server";
import type { AwardSearch, AwardSearchStatus } from "@/types/database";
import { z } from "zod";

function revalidateFlights() {
  revalidatePath("/flights");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function rowToSearch(row: Record<string, unknown>): AwardSearch {
  return {
    ...(row as unknown as AwardSearch),
    preferences:
      (row.preferences as AwardSearch["preferences"]) ??
      ({} as AwardSearch["preferences"]),
  };
}

export async function saveAwardSearchAction(input: unknown) {
  const parsed = awardSearchFormSchema.parse(input);
  const { supabase, user } = await requireUser();

  const payload = {
    user_id: user.id,
    trip_id: parsed.tripId ?? null,
    origin: parsed.origin.trim().toUpperCase(),
    destination: parsed.destination.trim().toUpperCase(),
    trip_type: parsed.tripType,
    depart_date: parsed.departDate || null,
    depart_date_end: parsed.departDateEnd || null,
    return_date: parsed.returnDate || null,
    return_date_end: parsed.returnDateEnd || null,
    passengers: parsed.passengers,
    cabin: parsed.cabin,
    max_points_per_passenger: parsed.maxPointsPerPassenger ?? null,
    max_points_total: parsed.maxPointsTotal ?? null,
    max_cash_fees: parsed.maxCashFees ?? null,
    preferred_program: parsed.preferredProgram || null,
    notify_on_match: parsed.notifyOnMatch,
    require_booking_approval: parsed.requireBookingApproval,
    poll_interval_minutes: parsed.pollIntervalMinutes,
    preferences: parsed.preferences,
    status: (isAwardSearchConfigured()
      ? "monitoring"
      : "setup_required") as AwardSearchStatus,
    paused_at: null,
  };

  let searchId = parsed.id;
  if (searchId) {
    const { error } = await supabase
      .from("award_searches")
      .update(payload)
      .eq("id", searchId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("award_searches")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to save search");
    searchId = data.id as string;
  }

  await supabase.from("award_search_programs").delete().eq("search_id", searchId);
  const programs = [...new Set(parsed.programs.filter(Boolean))];
  if (programs.length) {
    const { error } = await supabase.from("award_search_programs").insert(
      programs.map((program) => ({ search_id: searchId, program })),
    );
    if (error) throw new Error(error.message);
  }

  revalidateFlights();
  return { id: searchId };
}

export async function deleteAwardSearchAction(searchId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("award_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateFlights();
}

export async function setAwardSearchPausedAction(
  searchId: string,
  paused: boolean,
) {
  const { supabase, user } = await requireUser();
  const { data: existing, error: loadError } = await supabase
    .from("award_searches")
    .select("*")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();
  if (loadError || !existing) throw new Error(loadError?.message ?? "Not found");

  let status: AwardSearchStatus = paused
    ? "paused"
    : isAwardSearchConfigured()
      ? "monitoring"
      : "setup_required";
  if (!paused && existing.status === "match_found") status = "match_found";

  const { error } = await supabase
    .from("award_searches")
    .update({
      status,
      paused_at: paused ? new Date().toISOString() : null,
    })
    .eq("id", searchId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateFlights();
}

export async function runAwardSearchAction(searchId: string) {
  const { supabase, user } = await requireUser();
  const { data: row, error } = await supabase
    .from("award_searches")
    .select("*")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Search not found");

  const search = rowToSearch(row);
  const { data: programRows } = await supabase
    .from("award_search_programs")
    .select("program")
    .eq("search_id", searchId);
  const programs = (programRows ?? []).map((p) => p.program as string);

  const outcome = await executeAwardSearch(search, programs);
  const now = new Date().toISOString();

  await supabase
    .from("award_searches")
    .update({
      status: search.status === "paused" ? "paused" : outcome.status,
      last_checked_at: now,
    })
    .eq("id", searchId)
    .eq("user_id", user.id);

  if (outcome.options.length) {
    await persistAwardResults(supabase, searchId, outcome.options);
    if (search.status !== "paused") {
      await notifyAwardMatches(
        supabase,
        { ...search, status: outcome.status },
        outcome.options,
      );
    }
  }

  if (outcome.error && !outcome.setupRequired) {
    const { notifyUser } = await import("@/lib/notifications/notify");
    await notifyUser(supabase, {
      userId: user.id,
      type: "flight_search_error",
      message: `Award search failed for ${search.origin} → ${search.destination}: ${outcome.error}`,
      relatedTripId: search.trip_id,
      emailSubject: "Award search error",
      emailHtmlBody: `<p>Your award search for ${search.origin} → ${search.destination} failed.</p><p>${outcome.error}</p>`,
      ctaPath: "/flights",
      ctaLabel: "Open Flight Booker",
    });
  }

  revalidateFlights();
  return {
    status: outcome.status,
    count: outcome.options.length,
    error: outcome.error ?? null,
    setupRequired: Boolean(outcome.setupRequired),
  };
}

export async function saveLoyaltyBalanceAction(input: unknown) {
  const parsed = loyaltyBalanceSchema.parse(input);
  const { supabase, user } = await requireUser();

  const payload = {
    user_id: user.id,
    program: parsed.program.trim().toLowerCase(),
    balance: parsed.balance,
    currency_label: parsed.currencyLabel,
    source: "manual" as const,
    last_verified_at: new Date().toISOString(),
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("loyalty_balances")
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("loyalty_balances").upsert(payload, {
      onConflict: "user_id,program",
    });
    if (error) throw new Error(error.message);
  }

  revalidateFlights();
}

export async function deleteLoyaltyBalanceAction(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("loyalty_balances")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateFlights();
}

const idSchema = z.string().uuid();

export async function getAwardSearchDetailAction(searchId: string) {
  idSchema.parse(searchId);
  const { supabase, user } = await requireUser();
  const { data: search, error } = await supabase
    .from("award_searches")
    .select("*")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();
  if (error || !search) throw new Error(error?.message ?? "Not found");

  const { data: results } = await supabase
    .from("award_results")
    .select("*")
    .eq("search_id", searchId)
    .order("points_per_passenger", { ascending: true, nullsFirst: false });

  const { data: programs } = await supabase
    .from("award_search_programs")
    .select("program")
    .eq("search_id", searchId);

  return {
    search: rowToSearch(search),
    results: results ?? [],
    programs: (programs ?? []).map((p) => p.program as string),
  };
}
