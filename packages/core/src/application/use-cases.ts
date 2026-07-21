import { asPipelineError, PipelineError } from "../domain/errors.js";
import type { Batch, BatchDetail, BatchWithSummary, Lead } from "../domain/models.js";
import {
  calculateBatchSummary,
  normalizeLegalName,
  parsePublicWebsite,
  terminalLeadStatuses,
} from "../domain/rules.js";
import type {
  AiEnrichmentProvider,
  BatchRepository,
  CreateBatchInput,
  JobQueue,
  LeadRepository,
  PublicInfoProvider,
  WebhookSender,
  WebsiteAvailabilityChecker,
} from "./ports.js";

export class CreateBatch {
  constructor(
    private readonly batches: BatchRepository,
    private readonly queue: JobQueue,
  ) {}

  async execute(input: CreateBatchInput): Promise<Batch> {
    const batch = await this.batches.create(input);
    try {
      await this.queue.enqueueBatch(batch.id);
    } catch (error) {
      await this.batches.setStatus(batch.id, "failed");
      throw error;
    }
    return batch;
  }
}

export class ListBatches {
  constructor(private readonly batches: BatchRepository) {}
  execute(): Promise<BatchWithSummary[]> {
    return this.batches.list();
  }
}

export class GetBatchDetail {
  constructor(private readonly batches: BatchRepository) {}
  execute(id: string): Promise<BatchDetail | null> {
    return this.batches.getDetail(id);
  }
}

export class ProcessLead {
  constructor(
    private readonly leads: LeadRepository,
    private readonly websiteChecker: WebsiteAvailabilityChecker,
    private readonly publicInfo: PublicInfoProvider,
    private readonly ai: AiEnrichmentProvider,
  ) {}

  async execute(leadId: string): Promise<void> {
    const original = await this.requireLead(leadId);
    if (terminalLeadStatuses.has(original.status)) return;

    let currentStage: "validation" | "deduplication" | "contactability" | "public_info" | "ai" =
      "validation";

    try {
      await this.leads.transition(leadId, "pending", "processing");
      const lead = await this.requireLead(leadId);

      if (!lead.legalIdNormalized) {
        throw new PipelineError("missing_legal_id", "validation", "legal_id is required", false);
      }

      let website: URL;
      try {
        website = parsePublicWebsite(lead.website);
      } catch {
        throw new PipelineError("invalid_url", "validation", "website must be a valid HTTP(S) URL", false);
      }

      currentStage = "deduplication";
      const duplicate = await this.leads.findEarlierDuplicate(
        lead.batchId,
        lead.legalIdNormalized,
        lead.id,
      );
      if (duplicate) {
        throw new PipelineError("duplicate", "deduplication", "Duplicate legal_id inside batch", false);
      }

      currentStage = "contactability";
      const websiteAlive = await this.websiteChecker.check(website);
      await this.leads.saveContactability(leadId, {
        domain: website.hostname.replace(/^www\./, ""),
        normalizedName: normalizeLegalName(lead.legalName),
        websiteAlive,
      });
      await this.leads.transition(leadId, "processing", "ready");
      await this.leads.transition(leadId, "ready", "ai_enriching");

      currentStage = "public_info";
      const enrichedLead = await this.requireLead(leadId);
      const info = await this.publicInfo.fetch(enrichedLead);
      await this.leads.savePublicInfo(leadId, info);

      currentStage = "ai";
      const aiRun = await this.ai.enrich(enrichedLead, info);
      await this.leads.saveAiEnrichment(leadId, aiRun);
      await this.leads.transition(leadId, "ai_enriching", "ai_ready");
    } catch (error) {
      const pipelineError = asPipelineError(error, currentStage);
      const current = await this.requireLead(leadId);
      const status = current.status === "ai_enriching" ? "ai_failed" : "failed";
      await this.leads.fail(leadId, status, pipelineError.failure);
    }
  }

  private async requireLead(id: string): Promise<Lead> {
    const lead = await this.leads.getLead(id);
    if (!lead) throw new PipelineError("lead_not_found", "worker", "Lead not found", false);
    return lead;
  }
}

export class CompleteBatch {
  constructor(
    private readonly batches: BatchRepository,
    private readonly leads: LeadRepository,
    private readonly webhook: WebhookSender,
    private readonly webUrl: string,
  ) {}

  async execute(batchId: string): Promise<void> {
    const batch = await this.batches.getBatch(batchId);
    if (!batch) throw new PipelineError("batch_not_found", "worker", "Batch not found", false);

    const leads = await this.leads.listByBatch(batchId);
    if (!leads.every((lead) => terminalLeadStatuses.has(lead.status))) return;

    await this.batches.setStatus(batchId, "completed");
    if (batch.webhookSentAt) return;

    const summary = calculateBatchSummary(leads);
    const payload = {
      batch_id: batch.id,
      name: batch.name,
      summary: { total: summary.total, ready: summary.ready, failed: summary.failed },
      link_to_detail: `${this.webUrl}/batches/${batch.id}`,
    };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await this.webhook.send({
          url: batch.webhookUrl,
          idempotencyKey: `batch:${batch.id}:completed`,
          payload,
        });
        await this.batches.recordWebhookDelivery({
          batchId,
          attempt,
          statusCode: result.statusCode,
          error: null,
        });
        await this.batches.markWebhookSent(batchId, new Date());
        return;
      } catch (error) {
        await this.batches.recordWebhookDelivery({
          batchId,
          attempt,
          statusCode: null,
          error: error instanceof Error ? error.message : "Unknown webhook error",
        });
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
}

export class RetryFailedLeads {
  constructor(
    private readonly batches: BatchRepository,
    private readonly leads: LeadRepository,
    private readonly queue: JobQueue,
  ) {}

  async execute(batchId: string): Promise<{ retried: string[]; skipped: string[] }> {
    const batch = await this.batches.getBatch(batchId);
    if (!batch) throw new PipelineError("batch_not_found", "worker", "Batch not found", false);
    const result = await this.leads.resetRetryableFailures(batchId);
    if (result.retried.length > 0) {
      await this.batches.setStatus(batchId, "processing");
      await this.queue.enqueueBatch(batchId);
    }
    return result;
  }
}
