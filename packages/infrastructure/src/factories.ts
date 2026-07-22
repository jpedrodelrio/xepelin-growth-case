import type {
  AiEnrichmentProvider,
  ExecutionMode,
  PublicInfoProvider,
  WebhookSender,
  WebsiteAvailabilityChecker,
} from "@xepelin/core";
import {
  DemoAiEnrichmentProvider,
  DemoPublicInfoProvider,
  DemoWebsiteAvailabilityChecker,
  DemoWebhookSender,
  HttpWebsiteAvailabilityChecker,
  HttpWebhookSender,
  LivePublicInfoProvider,
  OpenAiEnrichmentProvider,
} from "./providers.js";

export function createWebsiteChecker(mode: ExecutionMode): WebsiteAvailabilityChecker {
  return mode === "live" ? new HttpWebsiteAvailabilityChecker() : new DemoWebsiteAvailabilityChecker();
}

export function createPublicInfoProvider(mode: ExecutionMode): PublicInfoProvider {
  if (mode === "demo") return new DemoPublicInfoProvider();
  if (process.env.PUBLIC_INFO_PROVIDER !== "live") {
    throw new Error("PUBLIC_INFO_PROVIDER=live is required for a live batch");
  }
  return new LivePublicInfoProvider(process.env.BRAVE_SEARCH_API_KEY);
}

export function createAiProvider(mode: ExecutionMode): AiEnrichmentProvider {
  if (mode === "demo") return new DemoAiEnrichmentProvider();
  if (process.env.AI_PROVIDER !== "openai") {
    throw new Error("AI_PROVIDER=openai is required for a live batch");
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for a live batch");
  return new OpenAiEnrichmentProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL ?? "gpt-5-mini-2025-08-07");
}

export function createWebhookSender(mode: ExecutionMode): WebhookSender {
  if (mode === "demo") return new DemoWebhookSender();
  if (process.env.WEBHOOK_PROVIDER !== "live") {
    throw new Error("WEBHOOK_PROVIDER=live is required for a live batch");
  }
  return new HttpWebhookSender();
}
