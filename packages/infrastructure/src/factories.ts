import type { AiEnrichmentProvider, PublicInfoProvider, WebhookSender } from "@xepelin/core";
import {
  DemoAiEnrichmentProvider,
  DemoPublicInfoProvider,
  DemoWebhookSender,
  HttpWebhookSender,
  LivePublicInfoProvider,
  OpenAiEnrichmentProvider,
} from "./providers.js";

export function createPublicInfoProvider(): PublicInfoProvider {
  if (process.env.PUBLIC_INFO_PROVIDER === "live") {
    if (!process.env.BRAVE_SEARCH_API_KEY) throw new Error("BRAVE_SEARCH_API_KEY is required in live mode");
    return new LivePublicInfoProvider(process.env.BRAVE_SEARCH_API_KEY);
  }
  return new DemoPublicInfoProvider();
}

export function createAiProvider(): AiEnrichmentProvider {
  if (process.env.AI_PROVIDER === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for AI_PROVIDER=openai");
    return new OpenAiEnrichmentProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL ?? "gpt-5-mini-2025-08-07");
  }
  return new DemoAiEnrichmentProvider();
}

export function createWebhookSender(): WebhookSender {
  return process.env.WEBHOOK_PROVIDER === "live" ? new HttpWebhookSender() : new DemoWebhookSender();
}
