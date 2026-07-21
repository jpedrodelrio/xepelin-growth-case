import { describe, expect, it } from "vitest";
import { getProviderCapabilities } from "./providers.controller.js";

describe("provider capabilities", () => {
  it("reports the free Wikipedia fallback without exposing credentials", () => {
    expect(getProviderCapabilities({
      AI_PROVIDER: "openai",
      PUBLIC_INFO_PROVIDER: "live",
      WEBHOOK_PROVIDER: "demo",
    })).toEqual({
      ai: { mode: "live", provider: "openai" },
      publicInfo: { mode: "live", source: "wikipedia" },
      webhook: { mode: "demo" },
      liveResearchReady: true,
    });
  });

  it("prioritizes Brave and blocks the test while external webhooks are enabled", () => {
    const result = getProviderCapabilities({
      AI_PROVIDER: "openai",
      PUBLIC_INFO_PROVIDER: "live",
      BRAVE_SEARCH_API_KEY: "configured",
      WEBHOOK_PROVIDER: "live",
    });

    expect(result.publicInfo.source).toBe("brave");
    expect(result.liveResearchReady).toBe(false);
    expect(JSON.stringify(result)).not.toContain("configured");
  });
});
