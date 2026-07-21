import {
  assertLeadTransition,
  calculateBatchSummary,
  normalizeLegalId,
  type AiEnrichment,
  type AiEnrichmentRun,
  type Batch,
  type BatchDetail,
  type BatchEvent,
  type BatchRepository,
  type BatchStatus as CoreBatchStatus,
  type BatchWithSummary,
  type CreateBatchInput,
  type DomainFailure,
  type Lead,
  type LeadRepository,
  type LeadStatus as CoreLeadStatus,
  type PublicCompanyInfo,
  type WebhookDelivery,
} from "@xepelin/core";
import {
  BatchStatus,
  LeadStatus,
  Prisma,
  type Batch as DbBatch,
  type BatchEvent as DbBatchEvent,
  type Lead as DbLead,
  type WebhookDelivery as DbWebhookDelivery,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma.js";

const aiExecutionSchema = z.object({
  provider: z.string().min(1),
  mode: z.enum(["demo", "live"]),
  model: z.string().min(1).nullable(),
  responseId: z.string().min(1).nullable(),
  completedAt: z.string().datetime(),
  latencyMs: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().positive().nullable(),
  reasoningEffort: z.string().min(1).nullable(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    reasoningTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }).nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
});

const batchToDb: Record<CoreBatchStatus, BatchStatus> = {
  pending: BatchStatus.PENDING,
  processing: BatchStatus.PROCESSING,
  completed: BatchStatus.COMPLETED,
  failed: BatchStatus.FAILED,
};
const batchFromDb = Object.fromEntries(Object.entries(batchToDb).map(([key, value]) => [value, key])) as Record<BatchStatus, CoreBatchStatus>;

const leadToDb: Record<CoreLeadStatus, LeadStatus> = {
  pending: LeadStatus.PENDING,
  processing: LeadStatus.PROCESSING,
  ready: LeadStatus.READY,
  failed: LeadStatus.FAILED,
  ai_enriching: LeadStatus.AI_ENRICHING,
  ai_ready: LeadStatus.AI_READY,
  ai_failed: LeadStatus.AI_FAILED,
};
const leadFromDb = Object.fromEntries(Object.entries(leadToDb).map(([key, value]) => [value, key])) as Record<LeadStatus, CoreLeadStatus>;

function mapBatch(row: DbBatch): Batch {
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    ownerEmail: row.ownerEmail,
    webhookUrl: row.webhookUrl,
    status: batchFromDb[row.status],
    webhookSentAt: row.webhookSentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLead(row: DbLead): Lead {
  const publicInfo = row.publicInfo as PublicCompanyInfo | null;
  const aiEvidence = Array.isArray(row.aiEvidence) ? row.aiEvidence.filter((item): item is string => typeof item === "string") : [];
  const parsedAiExecution = aiExecutionSchema.safeParse(row.aiExecution);
  return {
    id: row.id,
    batchId: row.batchId,
    legalId: row.legalId,
    legalIdNormalized: row.legalIdNormalized,
    legalName: row.legalName,
    website: row.website,
    status: leadFromDb[row.status],
    domain: row.domain,
    normalizedName: row.normalizedName,
    websiteAlive: row.websiteAlive,
    failure: row.errorCode && row.errorStage && row.errorReason
      ? {
          code: row.errorCode,
          stage: row.errorStage as DomainFailure["stage"],
          message: row.errorReason,
          retryable: row.errorRetryable ?? false,
        }
      : null,
    aiEnrichment: row.prospectFitScore !== null && row.fitJustification && row.iceBreaker && row.painHypothesis && row.aiConfidence
      ? {
          prospectFitScore: row.prospectFitScore,
          fitJustification: row.fitJustification,
          iceBreaker: row.iceBreaker,
          painHypothesis: row.painHypothesis,
          confidence: row.aiConfidence as AiEnrichment["confidence"],
          evidence: aiEvidence,
        }
      : null,
    aiExecution: parsedAiExecution.success ? parsedAiExecution.data : null,
    publicInfo,
    attempts: row.attempts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEvent(row: DbBatchEvent): BatchEvent {
  return {
    id: row.id,
    batchId: row.batchId,
    leadId: row.leadId,
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt,
  };
}

function mapDelivery(row: DbWebhookDelivery): WebhookDelivery {
  return { ...row };
}

export class PrismaRepositories implements BatchRepository, LeadRepository {
  async create(input: CreateBatchInput): Promise<Batch> {
    const row = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          name: input.name,
          segment: input.segment,
          ownerEmail: input.ownerEmail,
          webhookUrl: input.webhookUrl,
          leads: {
            create: input.leads.map((lead) => ({
              legalId: lead.legalId,
              legalIdNormalized: normalizeLegalId(lead.legalId),
              legalName: lead.legalName,
              website: lead.website,
            })),
          },
        },
      });
      await tx.batchEvent.create({ data: { batchId: batch.id, type: "batch_created", toStatus: "pending" } });
      return batch;
    });
    return mapBatch(row);
  }

  async list(): Promise<BatchWithSummary[]> {
    const rows = await prisma.batch.findMany({ include: { leads: true }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({ ...mapBatch(row), summary: calculateBatchSummary(row.leads.map(mapLead)) }));
  }

  async getDetail(id: string): Promise<BatchDetail | null> {
    const row = await prisma.batch.findUnique({
      where: { id },
      include: {
        leads: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 100 },
        deliveries: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) return null;
    const leads = row.leads.map(mapLead);
    return {
      ...mapBatch(row),
      summary: calculateBatchSummary(leads),
      leads,
      events: row.events.map(mapEvent),
      webhookDeliveries: row.deliveries.map(mapDelivery),
    };
  }

  async getBatch(id: string): Promise<Batch | null> {
    const row = await prisma.batch.findUnique({ where: { id } });
    return row ? mapBatch(row) : null;
  }

  async setStatus(id: string, status: CoreBatchStatus): Promise<void> {
    const current = await prisma.batch.findUnique({ where: { id }, select: { status: true } });
    await prisma.$transaction([
      prisma.batch.update({ where: { id }, data: { status: batchToDb[status] } }),
      prisma.batchEvent.create({
        data: { batchId: id, type: "batch_status_changed", fromStatus: current ? batchFromDb[current.status] : null, toStatus: status },
      }),
    ]);
  }

  async appendEvent(event: Omit<BatchEvent, "id" | "createdAt">): Promise<void> {
    await prisma.batchEvent.create({
      data: {
        ...event,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async recordWebhookDelivery(delivery: Omit<WebhookDelivery, "id" | "createdAt">): Promise<void> {
    await prisma.webhookDelivery.create({ data: delivery });
  }

  async markWebhookSent(id: string, sentAt: Date): Promise<void> {
    await prisma.batch.update({ where: { id }, data: { webhookSentAt: sentAt } });
  }

  async listByBatch(batchId: string): Promise<Lead[]> {
    return (await prisma.lead.findMany({ where: { batchId }, orderBy: { createdAt: "asc" } })).map(mapLead);
  }

  async findEarlierDuplicate(batchId: string, normalizedLegalId: string, leadId: string): Promise<Lead | null> {
    const row = await prisma.lead.findFirst({
      where: { batchId, legalIdNormalized: normalizedLegalId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return row && row.id !== leadId ? mapLead(row) : null;
  }

  async transition(id: string, from: CoreLeadStatus, to: CoreLeadStatus): Promise<void> {
    assertLeadTransition(from, to);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: { id, status: leadToDb[from] },
        data: {
          status: leadToDb[to],
          attempts: to === "processing" ? { increment: 1 } : undefined,
          errorCode: null,
          errorStage: null,
          errorReason: null,
          errorRetryable: null,
        },
      });
      if (updated.count !== 1) throw new Error(`Concurrent or invalid transition for lead ${id}: ${from} -> ${to}`);
      const lead = await tx.lead.findUniqueOrThrow({ where: { id }, select: { batchId: true } });
      await tx.batchEvent.create({
        data: { batchId: lead.batchId, leadId: id, type: "lead_status_changed", fromStatus: from, toStatus: to },
      });
    });
  }

  async getLead(id: string): Promise<Lead | null> {
    const row = await prisma.lead.findUnique({ where: { id } });
    return row ? mapLead(row) : null;
  }

  async saveContactability(id: string, value: { domain: string; normalizedName: string; websiteAlive: boolean }): Promise<void> {
    await prisma.lead.update({ where: { id }, data: value });
  }

  async savePublicInfo(id: string, value: PublicCompanyInfo): Promise<void> {
    await prisma.lead.update({ where: { id }, data: { publicInfo: value as unknown as Prisma.InputJsonValue } });
  }

  async saveAiEnrichment(id: string, value: AiEnrichmentRun): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: {
          prospectFitScore: value.enrichment.prospectFitScore,
          fitJustification: value.enrichment.fitJustification,
          iceBreaker: value.enrichment.iceBreaker,
          painHypothesis: value.enrichment.painHypothesis,
          aiConfidence: value.enrichment.confidence,
          aiEvidence: value.enrichment.evidence,
          aiExecution: value.execution as unknown as Prisma.InputJsonValue,
        },
        select: { batchId: true },
      });
      await tx.batchEvent.create({
        data: {
          batchId: lead.batchId,
          leadId: id,
          type: "ai_enrichment_completed",
          metadata: value.execution as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async fail(id: string, status: "failed" | "ai_failed", failure: DomainFailure): Promise<void> {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id }, select: { batchId: true, status: true } });
    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          status: leadToDb[status],
          errorCode: failure.code,
          errorStage: failure.stage,
          errorReason: failure.message,
          errorRetryable: failure.retryable,
        },
      }),
      prisma.batchEvent.create({
        data: {
          batchId: lead.batchId,
          leadId: id,
          type: "lead_failed",
          fromStatus: leadFromDb[lead.status],
          toStatus: status,
          metadata: failure as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  async resetRetryableFailures(batchId: string): Promise<{ retried: string[]; skipped: string[] }> {
    const failed = await prisma.lead.findMany({
      where: { batchId, status: { in: [LeadStatus.FAILED, LeadStatus.AI_FAILED] } },
      select: { id: true, errorRetryable: true },
    });
    const retried = failed.filter((lead) => lead.errorRetryable).map((lead) => lead.id);
    const skipped = failed.filter((lead) => !lead.errorRetryable).map((lead) => lead.id);
    if (retried.length > 0) {
      await prisma.lead.updateMany({
        where: { id: { in: retried } },
        data: { status: LeadStatus.PENDING, errorCode: null, errorStage: null, errorReason: null, errorRetryable: null },
      });
    }
    return { retried, skipped };
  }

}
