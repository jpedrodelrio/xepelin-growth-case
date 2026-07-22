import { Controller, Get } from "@nestjs/common";

export function getProviderCapabilities(env: Record<string, string | undefined> = process.env) {
  const ai = env.AI_PROVIDER === "openai"
    ? { mode: "live" as const, provider: "openai" as const }
    : { mode: "demo" as const, provider: "demo" as const };
  const publicInfo = env.PUBLIC_INFO_PROVIDER === "live"
    ? { mode: "live" as const, source: env.BRAVE_SEARCH_API_KEY ? "brave" as const : "wikipedia" as const }
    : { mode: "demo" as const, source: "synthetic" as const };
  const webhook = { mode: env.WEBHOOK_PROVIDER === "live" ? "live" as const : "demo" as const };

  return {
    ai,
    publicInfo,
    webhook,
    demoReady: true,
    liveResearchReady: ai.mode === "live" && publicInfo.mode === "live" && webhook.mode === "live",
  };
}

@Controller("providers")
export class ProvidersController {
  @Get("capabilities")
  capabilities() {
    return getProviderCapabilities();
  }
}
