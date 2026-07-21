import type { BatchSummary, Lead, LeadStatus } from "./models.js";

const allowedTransitions: Record<LeadStatus, readonly LeadStatus[]> = {
  pending: ["processing"],
  processing: ["ready", "failed"],
  ready: ["ai_enriching", "pending"],
  ai_enriching: ["ai_ready", "ai_failed"],
  ai_ready: [],
  failed: ["pending"],
  ai_failed: ["pending"],
};

export const terminalLeadStatuses = new Set<LeadStatus>([
  "ready",
  "failed",
  "ai_ready",
  "ai_failed",
]);

export function assertLeadTransition(from: LeadStatus, to: LeadStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid lead transition: ${from} -> ${to}`);
  }
}

export function normalizeLegalId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeLegalName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(SPA|S\.A\.?|SA DE CV|LTDA\.?|LIMITADA)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function parsePublicWebsite(value: string): URL {
  if (!value.trim()) throw new Error("Website is required");
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Website must use HTTP or HTTPS");
  }
  return parsed;
}

export function calculateBatchSummary(leads: Lead[]): BatchSummary {
  const total = leads.length;
  const ready = leads.filter((lead) => ["ready", "ai_ready"].includes(lead.status)).length;
  const failed = leads.filter((lead) => ["failed", "ai_failed"].includes(lead.status)).length;
  const pending = total - ready - failed;

  return {
    total,
    ready,
    failed,
    pending,
    readyPercentage: total === 0 ? 0 : Math.round((ready / total) * 100),
    failedPercentage: total === 0 ? 0 : Math.round((failed / total) * 100),
  };
}
