import { LOYALTY_PROGRAMS } from "@/lib/flights/loyalty-programs";

/**
 * Map Waypoint loyalty program ids → AwardWallet Web Parsing provider codes.
 * Codes follow AwardWallet `/providers/list` style (alphanumeric, no spaces).
 */
export const WAYPOINT_TO_AW_PROVIDER: Record<string, string> = {
  united: "united",
  american: "aa",
  delta: "delta",
  aeroplan: "aeroplan",
  alaska: "alaskaair",
  flyingblue: "flyingblue",
  britishairways: "britishairways",
  lufthansa: "lufthansa",
  singapore: "singapore",
  qatar: "qatar",
  emirates: "emirates",
  jetblue: "jetblue",
  virginatlantic: "virginatlantic",
  qantas: "qantas",
};

export function awardWalletProviderForProgram(programId: string): string | null {
  const mapped = WAYPOINT_TO_AW_PROVIDER[programId];
  if (mapped) return mapped;
  const known = LOYALTY_PROGRAMS.find((p) => p.id === programId);
  return known ? programId : null;
}

export function waypointProgramFromProvider(providerCode: string): string {
  const code = providerCode.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const entry = Object.entries(WAYPOINT_TO_AW_PROVIDER).find(
    ([, aw]) => aw === code || aw.replace(/[^a-z0-9]/g, "") === code,
  );
  if (entry) return entry[0];
  // Heuristic fallbacks
  if (code === "aa" || code.includes("aadvantage")) return "american";
  if (code.includes("alaska")) return "alaska";
  if (code.includes("kris") || code.includes("singapore")) return "singapore";
  if (code.includes("milesandmore") || code.includes("lufthansa")) return "lufthansa";
  return code.slice(0, 64) || "unknown";
}
