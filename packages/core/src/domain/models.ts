export const leadStatuses = [
  "pending",
  "processing",
  "ready",
  "failed",
  "ai_enriching",
  "ai_ready",
  "ai_failed",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];
export type BatchStatus = "pending" | "processing" | "completed" | "failed";
export type ExecutionMode = "demo" | "live";

export type FailureStage =
  | "validation"
  | "deduplication"
  | "contactability"
  | "public_info"
  | "ai"
  | "webhook"
  | "worker";

export interface DomainFailure {
  code: string;
  stage: FailureStage;
  message: string;
  retryable: boolean;
}

export interface AiEnrichment {
  prospectFitScore: number;
  fitJustification: string;
  iceBreaker: string;
  painHypothesis: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
}

export interface AiExecutionMetadata {
  provider: string;
  mode: "demo" | "live";
  model: string | null;
  responseId: string | null;
  completedAt: string;
  latencyMs: number;
  maxOutputTokens: number | null;
  reasoningEffort: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  } | null;
  estimatedCostUsd: number | null;
}

export interface AiEnrichmentRun {
  enrichment: AiEnrichment;
  execution: AiExecutionMetadata;
}

export interface PublicCompanyInfo {
  summary: string;
  sources: Array<{ url: string; title: string; snippet: string }>;
}

export interface Lead {
  id: string;
  batchId: string;
  legalId: string;
  legalIdNormalized: string;
  legalName: string;
  website: string;
  status: LeadStatus;
  domain: string | null;
  normalizedName: string | null;
  websiteAlive: boolean | null;
  failure: DomainFailure | null;
  aiEnrichment: AiEnrichment | null;
  aiExecution: AiExecutionMetadata | null;
  publicInfo: PublicCompanyInfo | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: string;
  name: string;
  segment: string;
  ownerEmail: string;
  webhookUrl: string;
  executionMode: ExecutionMode;
  status: BatchStatus;
  webhookSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchSummary {
  total: number;
  ready: number;
  failed: number;
  pending: number;
  readyPercentage: number;
  failedPercentage: number;
}

export interface BatchWithSummary extends Batch {
  summary: BatchSummary;
}

export interface BatchDetail extends BatchWithSummary {
  leads: Lead[];
  events: BatchEvent[];
  webhookDeliveries: WebhookDelivery[];
}

export interface BatchEvent {
  id: string;
  batchId: string;
  leadId: string | null;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface WebhookDelivery {
  id: string;
  batchId: string;
  mode: "demo" | "live" | "unknown";
  attempt: number;
  statusCode: number | null;
  error: string | null;
  createdAt: Date;
}
