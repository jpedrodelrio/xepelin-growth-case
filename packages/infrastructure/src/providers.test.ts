import { describe, expect, it } from "vitest";
import type { Lead, PublicCompanyInfo } from "@xepelin/core";
import { DemoAiEnrichmentProvider, DemoPublicInfoProvider, estimateOpenAiCostUsd } from "./providers.js";

const lead: Lead = {
  id: "lead-1",
  batchId: "batch-1",
  legalId: "76.123.456-7",
  legalIdNormalized: "761234567",
  legalName: "Comercializadora Andes SpA",
  website: "https://andes.example",
  status: "ai_enriching",
  domain: "andes.example",
  normalizedName: "comercializadora andes spa",
  websiteAlive: true,
  failure: null,
  aiEnrichment: null,
  aiExecution: null,
  publicInfo: null,
  attempts: 1,
  createdAt: new Date("2026-07-21T00:00:00.000Z"),
  updatedAt: new Date("2026-07-21T00:00:00.000Z"),
};

const publicInfo: PublicCompanyInfo = {
  summary: "Empresa B2B sintética",
  sources: [{ url: "https://andes.example", title: "Sitio", snippet: "Operación B2B" }],
};

describe("AI providers", () => {
  it("builds two differentiated synthetic public sources", async () => {
    const info = await new DemoPublicInfoProvider().fetch({
      ...lead,
      legalName: "Transportes Ruta Austral Ltda",
    });

    expect(info.sources).toHaveLength(2);
    expect(info.sources[0]).toMatchObject({ title: "Sitio sintético de Transportes Ruta Austral Ltda" });
    expect(info.sources[1]).toMatchObject({ title: "Directorio B2B sintético" });
    expect(info.summary).toContain("flota");
    expect(info.summary).toContain("combustible");
  });

  it("marks deterministic enrichment as demo execution", async () => {
    const run = await new DemoAiEnrichmentProvider().enrich(lead, publicInfo);

    expect(run.enrichment.prospectFitScore).toBeGreaterThanOrEqual(60);
    expect(run.execution).toMatchObject({
      provider: "demo",
      mode: "demo",
      model: "deterministic-fixture-v1",
      responseId: null,
      estimatedCostUsd: 0,
    });
  });

  it("calculates a conservative GPT-5 mini token cost", () => {
    const usage = { inputTokens: 337, outputTokens: 424, reasoningTokens: 128, totalTokens: 761 };

    expect(estimateOpenAiCostUsd("gpt-5-mini-2025-08-07", usage)).toBe(0.00093225);
    expect(estimateOpenAiCostUsd("another-model", usage)).toBeNull();
  });
});
