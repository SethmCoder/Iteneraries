import { describe, expect, it } from "vitest";
import {
  FLIGHT_MCP_SUPPORTED_ROUTES,
  searchFlightMcpCache,
} from "@/lib/flights/flight-mcp-cache";

describe("Flight MCP Open Cache", () => {
  it("lists supported routes", () => {
    expect(FLIGHT_MCP_SUPPORTED_ROUTES).toContain("HND→LAX");
    expect(FLIGHT_MCP_SUPPORTED_ROUTES.length).toBe(10);
  });

  it("rejects unsupported pairs without calling the network", async () => {
    const result = await searchFlightMcpCache({
      origin: "BOI",
      destination: "HNL",
      departureDate: "2026-11-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNSUPPORTED_ROUTE");
    }
  });
});
