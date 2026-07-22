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
      demoReady: true,
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

  it("keeps the deterministic demo available while live providers are configured", () => {
    const result = getProviderCapabilities({
      AI_PROVIDER: "openai",
      PUBLIC_INFO_PROVIDER: "live",
      WEBHOOK_PROVIDER: "live",
    });

    expect(result.demoReady).toBe(true);
    expect(result.liveResearchReady).toBe(true);
  });
});
