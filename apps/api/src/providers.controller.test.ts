import { describe, expect, it } from "vitest";
import { getProviderCapabilities } from "./providers.controller.js";

describe("provider capabilities", () => {
  it("requires a live webhook for the end-to-end live test", () => {
    expect(getProviderCapabilities({
      AI_PROVIDER: "openai",
      PUBLIC_INFO_PROVIDER: "live",
      WEBHOOK_PROVIDER: "live",
    })).toEqual({
      ai: { mode: "live", provider: "openai" },
      publicInfo: { mode: "live", source: "wikipedia" },
      webhook: { mode: "live" },
      demoReady: false,
      liveResearchReady: true,
    });
  });

  it("prioritizes Brave without exposing its credential", () => {
    const result = getProviderCapabilities({
      AI_PROVIDER: "openai",
      PUBLIC_INFO_PROVIDER: "live",
      BRAVE_SEARCH_API_KEY: "configured",
      WEBHOOK_PROVIDER: "live",
    });

    expect(result.publicInfo.source).toBe("brave");
    expect(result.liveResearchReady).toBe(true);
    expect(JSON.stringify(result)).not.toContain("configured");
  });

  it("only enables the deterministic demo when every provider is in demo mode", () => {
    const result = getProviderCapabilities({});

    expect(result.demoReady).toBe(true);
    expect(result.liveResearchReady).toBe(false);
  });
});
