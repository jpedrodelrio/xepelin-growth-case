import type {
  AiEnrichmentRun,
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

export interface CreateBatchInput {
  name: string;
  segment: string;
  ownerEmail: string;
  webhookUrl: string;
  leads: Array<{ legalId: string; legalName: string; website: string }>;
}

export interface BatchRepository {
  create(input: CreateBatchInput): Promise<Batch>;
  list(): Promise<BatchWithSummary[]>;
  getDetail(id: string): Promise<BatchDetail | null>;
  getBatch(id: string): Promise<Batch | null>;
  setStatus(id: string, status: BatchStatus): Promise<void>;
  appendEvent(event: Omit<BatchEvent, "id" | "createdAt">): Promise<void>;
  recordWebhookDelivery(delivery: Omit<WebhookDelivery, "id" | "createdAt">): Promise<void>;
  markWebhookSent(id: string, sentAt: Date): Promise<void>;
}

export interface LeadRepository {
  getLead(id: string): Promise<Lead | null>;
  listByBatch(batchId: string): Promise<Lead[]>;
  findEarlierDuplicate(batchId: string, normalizedLegalId: string, leadId: string): Promise<Lead | null>;
  transition(id: string, from: LeadStatus, to: LeadStatus): Promise<void>;
  saveContactability(
    id: string,
    value: { domain: string; normalizedName: string; websiteAlive: boolean },
  ): Promise<void>;
  savePublicInfo(id: string, value: PublicCompanyInfo): Promise<void>;
  saveAiEnrichment(id: string, value: AiEnrichmentRun): Promise<void>;
  fail(id: string, status: "failed" | "ai_failed", failure: DomainFailure): Promise<void>;
  resetRetryableFailures(batchId: string): Promise<{ retried: string[]; skipped: string[] }>;
}

export interface JobQueue {
  enqueueBatch(batchId: string): Promise<void>;
}

export interface WebsiteAvailabilityChecker {
  check(url: URL): Promise<boolean>;
}

export interface PublicInfoProvider {
  fetch(lead: Lead): Promise<PublicCompanyInfo>;
}

export interface AiEnrichmentProvider {
  enrich(lead: Lead, publicInfo: PublicCompanyInfo): Promise<AiEnrichmentRun>;
}

export interface WebhookSender {
  readonly mode: "demo" | "live";
  send(input: {
    url: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }): Promise<{ statusCode: number; ok: boolean }>;
}
