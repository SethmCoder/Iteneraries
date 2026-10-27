import { FlightBookerWorkspace } from "@/components/flights/flight-booker-workspace";
import {
  demoAwardSearches,
  demoLoyaltyBalances,
} from "@/lib/flights/demo";
import { hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import {
  getInboundEmailAddress,
  isAwardSearchConfigured,
  isEmailImportConfigured,
  isLoyaltyLinkConfigured,
  isWebParseConfigured,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  AwardResult,
  AwardSearch,
  LoyaltyBalance,
  LoyaltyConnection,
} from "@/types/database";

export const metadata = { title: "Flight Booker" };

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tripId?: string;
    loyaltyLinked?: string;
    synced?: string;
    loyaltyError?: string;
  }>;
}) {
  const params = await searchParams;
  const tripId = params.tripId ?? null;
  const loyaltyFlash = params.loyaltyError
    ? params.loyaltyError
    : params.loyaltyLinked
      ? `AwardWallet connected${params.synced ? ` · ${params.synced} balance(s) imported` : ""}.`
      : null;

  if (isDemoModeEnabled() && (await hasDemoSession())) {
    const searches = demoAwardSearches();
    return (
      <FlightBookerWorkspace
        searches={searches}
        resultsBySearch={{}}
        programsBySearch={{
          [searches[0].id]: ["united", "aeroplan"],
        }}
        balances={demoLoyaltyBalances()}
        loyaltyConnection={null}
        loyaltyLinkConfigured={false}
        webParseConfigured={false}
        tripId={tripId}
        awardConfigured={isAwardSearchConfigured()}
        emailForward={{ configured: false, address: null }}
        isDemo
        loyaltyFlash={null}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: searches } = await supabase
    .from("award_searches")
    .select("*")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  const searchIds = (searches ?? []).map((s) => s.id as string);

  const { data: results } =
    searchIds.length > 0
      ? await supabase
          .from("award_results")
          .select("*")
          .in("search_id", searchIds)
          .order("points_per_passenger", { ascending: true, nullsFirst: false })
      : { data: [] as AwardResult[] };

  const { data: programRows } =
    searchIds.length > 0
      ? await supabase
          .from("award_search_programs")
          .select("search_id, program")
          .in("search_id", searchIds)
      : { data: [] as { search_id: string; program: string }[] };

  const { data: balances } = await supabase
    .from("loyalty_balances")
    .select("*")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  const { data: connection } = await supabase
    .from("loyalty_connections")
    .select("*")
    .eq("user_id", user!.id)
    .eq("provider", "awardwallet")
    .maybeSingle();

  const { data: alias } = await supabase
    .from("email_aliases")
    .select("alias_token")
    .eq("user_id", user!.id)
    .maybeSingle();

  const inbound = getInboundEmailAddress();
  const personalAddress =
    inbound && alias?.alias_token
      ? inbound.replace("@", `+${alias.alias_token}@`)
      : inbound;

  const resultsBySearch: Record<string, AwardResult[]> = {};
  for (const r of (results ?? []) as AwardResult[]) {
    const list = resultsBySearch[r.search_id] ?? [];
    list.push(r);
    resultsBySearch[r.search_id] = list;
  }

  const programsBySearch: Record<string, string[]> = {};
  for (const row of programRows ?? []) {
    const list = programsBySearch[row.search_id] ?? [];
    list.push(row.program);
    programsBySearch[row.search_id] = list;
  }

  const normalizedSearches = ((searches ?? []) as AwardSearch[]).map((s) => ({
    ...s,
    preferences: s.preferences ?? {},
  }));

  return (
    <FlightBookerWorkspace
      searches={normalizedSearches}
      resultsBySearch={resultsBySearch}
      programsBySearch={programsBySearch}
      balances={(balances ?? []) as LoyaltyBalance[]}
      loyaltyConnection={(connection as LoyaltyConnection | null) ?? null}
      loyaltyLinkConfigured={isLoyaltyLinkConfigured()}
      webParseConfigured={isWebParseConfigured()}
      tripId={tripId}
      awardConfigured={isAwardSearchConfigured()}
      emailForward={{
        configured: isEmailImportConfigured(),
        address: personalAddress,
      }}
      isDemo={false}
      loyaltyFlash={loyaltyFlash}
    />
  );
}
