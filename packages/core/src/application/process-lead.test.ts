import { describe, expect, it } from "vitest";
import type {
  AiEnrichment,
  AiEnrichmentRun,
  DomainFailure,
  Lead,
  LeadStatus,
  PublicCompanyInfo,
} from "../domain/models.js";
import type { LeadRepository } from "./ports.js";
import { ProcessLead } from "./use-cases.js";

class MemoryLeads implements LeadRepository {
  constructor(public lead: Lead, private readonly duplicate: Lead | null = null) {}
  async getLead() { return this.lead; }
  async listByBatch() { return [this.lead]; }
  async findEarlierDuplicate() { return this.duplicate; }
  async transition(_id: string, from: LeadStatus, to: LeadStatus) {
    expect(this.lead.status).toBe(from);
    this.lead = { ...this.lead, status: to };
  }
  async saveContactability(_id: string, value: { domain: string; normalizedName: string; websiteAlive: boolean }) {
    this.lead = { ...this.lead, ...value };
  }
  async savePublicInfo(_id: string, publicInfo: PublicCompanyInfo) { this.lead = { ...this.lead, publicInfo }; }
  async saveAiEnrichment(_id: string, run: AiEnrichmentRun) {
    this.lead = { ...this.lead, aiEnrichment: run.enrichment, aiExecution: run.execution };
  }
  async fail(_id: string, status: "failed" | "ai_failed", failure: DomainFailure) { this.lead = { ...this.lead, status, failure }; }
  async resetRetryableFailures() { return { retried: [], skipped: [] }; }
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1", batchId: "batch-1", legalId: "76.123.456-7", legalIdNormalized: "761234567",
    legalName: "Comercializadora Andes SpA", website: "https://andes.example", status: "pending",
    domain: null, normalizedName: null, websiteAlive: null, failure: null, aiEnrichment: null, aiExecution: null,
    publicInfo: null, attempts: 0, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

const info: PublicCompanyInfo = {
  summary: "Empresa B2B con pagos recurrentes",
  sources: [{ url: "https://andes.example", title: "Sitio", snippet: "Operación B2B" }],
};
const ai: AiEnrichment = {
  prospectFitScore: 82,
  fitJustification: "Existe afinidad B2B",
  iceBreaker: "¿Cómo gestionan sus pagos?",
  painHypothesis: "Hipótesis: capital de trabajo",
  confidence: "medium",
  evidence: ["Sitio"],
};
const aiRun: AiEnrichmentRun = {
  enrichment: ai,
  execution: {
    provider: "fake",
    mode: "demo",
    model: "fake-v1",
    responseId: null,
    completedAt: "2026-07-21T00:00:00.000Z",
    latencyMs: 0,
    maxOutputTokens: null,
    reasoningEffort: null,
    usage: null,
    estimatedCostUsd: 0,
  },
};

describe("ProcessLead", () => {
  it("runs the complete state machine through ai_ready", async () => {
    const repository = new MemoryLeads(makeLead());
    const useCase = new ProcessLead(
      repository,
      { check: async () => true },
      { fetch: async () => info },
      { enrich: async () => aiRun },
    );
    await useCase.execute("lead-1");
    expect(repository.lead.status).toBe("ai_ready");
    expect(repository.lead.domain).toBe("andes.example");
    expect(repository.lead.aiEnrichment?.prospectFitScore).toBe(82);
    expect(repository.lead.aiExecution).toMatchObject({ provider: "fake", mode: "demo" });
  });

  it("stores invalid URLs as permanent validation failures", async () => {
    const repository = new MemoryLeads(makeLead({ website: "not-a-url" }));
    const useCase = new ProcessLead(repository, { check: async () => true }, { fetch: async () => info }, { enrich: async () => aiRun });
    await useCase.execute("lead-1");
    expect(repository.lead.status).toBe("failed");
    expect(repository.lead.failure).toMatchObject({ code: "invalid_url", retryable: false });
  });
});
