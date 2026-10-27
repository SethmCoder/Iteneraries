import { NextResponse } from "next/server";
import { getCronSecret, isAwardSearchConfigured } from "@/lib/env";
import {
  executeAwardSearch,
  notifyAwardMatches,
  persistAwardResults,
} from "@/lib/flights/run-search";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { AwardSearch } from "@/types/database";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 503 },
    );
  }
  if (!isAwardSearchConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "SEATS_AERO_API_KEY unset",
    });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const { data: searches, error } = await admin
    .from("award_searches")
    .select("*")
    .in("status", ["monitoring", "match_found"])
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let checked = 0;
  let matches = 0;
  const failures: string[] = [];

  for (const row of searches ?? []) {
    const search = {
      ...row,
      preferences: row.preferences ?? {},
    } as AwardSearch;

    const intervalMs = Math.max(60, search.poll_interval_minutes) * 60_000;
    if (
      search.last_checked_at &&
      now - new Date(search.last_checked_at).getTime() < intervalMs
    ) {
      continue;
    }

    const { data: programRows } = await admin
      .from("award_search_programs")
      .select("program")
      .eq("search_id", search.id);
    const programs = (programRows ?? []).map((p) => p.program as string);

    try {
      const outcome = await executeAwardSearch(search, programs);
      checked += 1;
      await admin
        .from("award_searches")
        .update({
          status: outcome.status,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", search.id);

      if (outcome.options.length) {
        matches += outcome.options.length;
        await persistAwardResults(admin, search.id, outcome.options);
        await notifyAwardMatches(admin, search, outcome.options);
      }
    } catch (e) {
      failures.push(`${search.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    matches,
    failures,
  });
}
