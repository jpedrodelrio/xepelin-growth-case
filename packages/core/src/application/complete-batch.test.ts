import { describe, expect, it } from "vitest";
import type {
  Batch,
  BatchDetail,
  BatchEvent,
  BatchStatus,
  BatchWithSummary,
  DomainFailure,
  Lead,
  LeadStatus,
  PublicCompanyInfo,
  WebhookDelivery,
} from "../domain/models.js";
import type { BatchRepository, CreateBatchInput, LeadRepository, WebhookSender } from "./ports.js";
import { CompleteBatch } from "./use-cases.js";

class MemoryRepositories implements BatchRepository, LeadRepository {
  readonly deliveries: Array<Omit<WebhookDelivery, "id" | "createdAt">> = [];
  readonly statusChanges: BatchStatus[] = [];
  markSentCalls = 0;

  constructor(public batch: Batch, private readonly leads: Lead[]) {}

  async create(_input: CreateBatchInput): Promise<Batch> { return this.batch; }
  async list(): Promise<BatchWithSummary[]> { return []; }
  async getDetail(_id: string): Promise<BatchDetail | null> { return null; }
  async getBatch(_id: string): Promise<Batch | null> { return this.batch; }
  async setStatus(_id: string, status: BatchStatus): Promise<void> {
    this.statusChanges.push(status);
    this.batch = { ...this.batch, status };
  }
  async appendEvent(_event: Omit<BatchEvent, "id" | "createdAt">): Promise<void> {}
  async recordWebhookDelivery(delivery: Omit<WebhookDelivery, "id" | "createdAt">): Promise<void> {
    this.deliveries.push(delivery);
  }
  async markWebhookSent(_id: string, sentAt: Date): Promise<void> {
    this.markSentCalls += 1;
    this.batch = { ...this.batch, webhookSentAt: sentAt };
  }
  async getLead(id: string): Promise<Lead | null> { return this.leads.find((lead) => lead.id === id) ?? null; }
  async listByBatch(_batchId: string): Promise<Lead[]> { return this.leads; }
  async findEarlierDuplicate(): Promise<Lead | null> { return null; }
  async transition(_id: string, _from: LeadStatus, _to: LeadStatus): Promise<void> {}
  async saveContactability(): Promise<void> {}
  async savePublicInfo(_id: string, _value: PublicCompanyInfo): Promise<void> {}
  async saveAiEnrichment(): Promise<void> {}
  async fail(_id: string, _status: "failed" | "ai_failed", _failure: DomainFailure): Promise<void> {}
  async resetRetryableFailures(): Promise<{ retried: string[]; skipped: string[] }> {
    return { retried: [], skipped: [] };
  }
}

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "batch-1",
    name: "Prospectos Chile",
    segment: "B2B",
    ownerEmail: "growth@example.com",
    webhookUrl: "https://hooks.example.com/xepelin",
    status: "processing",
    webhookSentAt: null,
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
    updatedAt: new Date("2026-07-21T00:00:00.000Z"),
    ...overrides,
  };
}

function makeLead(id: string, status: LeadStatus): Lead {
  return {
    id,
    batchId: "batch-1",
    legalId: id,
    legalIdNormalized: id,
    legalName: `Empresa ${id}`,
    website: "https://example.com",
    status,
    domain: "example.com",
    normalizedName: `empresa ${id}`,
    websiteAlive: true,
    failure: null,
    aiEnrichment: null,
    aiExecution: null,
    publicInfo: null,
    attempts: 1,
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
    updatedAt: new Date("2026-07-21T00:00:00.000Z"),
  };
}

describe("CompleteBatch", () => {
  it("does not complete or send while any lead is non-terminal", async () => {
    const repositories = new MemoryRepositories(makeBatch(), [
      makeLead("ready", "ai_ready"),
      makeLead("pending", "processing"),
    ]);
    let sendCalls = 0;
    const webhook: WebhookSender = {
      send: async () => {
        sendCalls += 1;
        return { statusCode: 200, ok: true };
      },
    };

    const result = await new CompleteBatch(repositories, repositories, webhook, "https://app.example.com").execute("batch-1");

    expect(result).toEqual({ completed: false, webhookStatus: "not_due", webhookAttempts: [] });
    expect(sendCalls).toBe(0);
    expect(repositories.statusChanges).toEqual([]);
  });

  it("posts the required payload and traces a successful delivery", async () => {
    const repositories = new MemoryRepositories(makeBatch(), [
      makeLead("ready", "ai_ready"),
      makeLead("failed", "failed"),
    ]);
    const requests: Parameters<WebhookSender["send"]>[0][] = [];
    const webhook: WebhookSender = {
      send: async (input) => {
        requests.push(input);
        return { statusCode: 200, ok: true };
      },
    };

    const result = await new CompleteBatch(repositories, repositories, webhook, "https://app.example.com").execute("batch-1");

    expect(result).toMatchObject({ completed: true, webhookStatus: "delivered" });
    expect(requests).toEqual([{
      url: "https://hooks.example.com/xepelin",
      idempotencyKey: "batch:batch-1:completed",
      payload: {
        batch_id: "batch-1",
        name: "Prospectos Chile",
        summary: { total: 2, ready: 1, failed: 1 },
        link_to_detail: "https://app.example.com/batches/batch-1",
      },
    }]);
    expect(repositories.deliveries).toEqual([{
      batchId: "batch-1",
      attempt: 1,
      statusCode: 200,
      error: null,
    }]);
    expect(repositories.markSentCalls).toBe(1);
  });

  it("stores a 500 status code and retries with the same idempotency key", async () => {
    const repositories = new MemoryRepositories(makeBatch(), [makeLead("ready", "ai_ready")]);
    const keys: string[] = [];
    const responses = [
      { statusCode: 500, ok: false },
      { statusCode: 202, ok: true },
    ];
    const webhook: WebhookSender = {
      send: async (input) => {
        keys.push(input.idempotencyKey);
        return responses.shift() ?? { statusCode: 500, ok: false };
      },
    };

    const result = await new CompleteBatch(
      repositories,
      repositories,
      webhook,
      "https://app.example.com",
      async () => {},
    ).execute("batch-1");

    expect(result.webhookStatus).toBe("delivered");
    expect(keys).toEqual(["batch:batch-1:completed", "batch:batch-1:completed"]);
    expect(repositories.deliveries).toEqual([
      { batchId: "batch-1", attempt: 1, statusCode: 500, error: "Webhook returned 500" },
      { batchId: "batch-1", attempt: 2, statusCode: 202, error: null },
    ]);
  });

  it("does not emit a second logical webhook after it was sent", async () => {
    const repositories = new MemoryRepositories(
      makeBatch({ status: "completed", webhookSentAt: new Date("2026-07-21T01:00:00.000Z") }),
      [makeLead("ready", "ai_ready")],
    );
    let sendCalls = 0;
    const webhook: WebhookSender = {
      send: async () => {
        sendCalls += 1;
        return { statusCode: 200, ok: true };
      },
    };

    const result = await new CompleteBatch(repositories, repositories, webhook, "https://app.example.com").execute("batch-1");

    expect(result).toEqual({ completed: true, webhookStatus: "already_sent", webhookAttempts: [] });
    expect(sendCalls).toBe(0);
    expect(repositories.deliveries).toEqual([]);
    expect(repositories.statusChanges).toEqual([]);
  });
});
