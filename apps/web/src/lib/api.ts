export interface BatchSummary { total: number; ready: number; failed: number; pending: number; readyPercentage: number; failedPercentage: number }
export interface BatchListItem { id: string; name: string; segment: string; ownerEmail: string; executionMode: "demo" | "live"; status: string; createdAt: string; summary: BatchSummary }
export interface AiExecutionMetadata {
  provider: string; mode: "demo" | "live"; model: string | null; responseId: string | null;
  completedAt: string; latencyMs: number; maxOutputTokens: number | null; reasoningEffort: string | null;
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number; totalTokens: number } | null;
  estimatedCostUsd: number | null;
}
export interface BatchEventItem {
  id: string; leadId: string | null; type: string; fromStatus: string | null; toStatus: string | null; createdAt: string;
}
export interface LeadItem {
  id: string; legalId: string; legalName: string; website: string; status: string; domain: string | null;
  normalizedName: string | null; websiteAlive: boolean | null;
  failure: { code: string; stage: string; message: string; retryable: boolean } | null;
  aiEnrichment: { prospectFitScore: number; fitJustification: string; iceBreaker: string; painHypothesis: string; confidence: string; evidence: string[] } | null;
  aiExecution: AiExecutionMetadata | null;
  createdAt: string; updatedAt: string;
}
export interface BatchDetail extends BatchListItem {
  updatedAt: string;
  leads: LeadItem[];
  events: BatchEventItem[];
  webhookDeliveries: Array<{ id: string; mode: "demo" | "live" | "unknown"; attempt: number; statusCode: number | null; error: string | null; createdAt: string }>;
}
export interface ProviderCapabilities {
  ai: { mode: "demo" | "live"; provider: "demo" | "openai" };
  publicInfo: { mode: "demo" | "live"; source: "synthetic" | "brave" | "wikipedia" };
  webhook: { mode: "demo" | "live" };
  demoReady: boolean;
  liveResearchReady: boolean;
}

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export async function getBatches(): Promise<BatchListItem[]> {
  try {
    const response = await fetch(`${apiUrl}/batches`, { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch { return []; }
}

export async function getProviderCapabilities(): Promise<ProviderCapabilities> {
  try {
    const response = await fetch(`${apiUrl}/providers/capabilities`, { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    return {
      ai: { mode: "demo", provider: "demo" },
      publicInfo: { mode: "demo", source: "synthetic" },
      webhook: { mode: "demo" },
      demoReady: true,
      liveResearchReady: false,
    };
  }
}

export async function getBatch(id: string): Promise<BatchDetail | null> {
  try {
    const response = await fetch(`${apiUrl}/batches/${id}`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}
