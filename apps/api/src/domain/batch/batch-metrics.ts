import { isTerminalLeadStatus, LeadStatus } from '@domain/lead/lead-status';

export interface BatchMetrics {
  totalLeads: number;
  readyCount: number; // leads que pasaron Parte A (incluye los que luego llegaron a AI_READY/AI_FAILED)
  failedCount: number; // fallos de Parte A (validación/dedupe)
  aiReadyCount: number;
  aiFailedCount: number;
}

/**
 * Deriva las métricas del batch a partir del estado de sus leads.
 * Es una función pura: la fuente de verdad es el conjunto de leads, no contadores mutables
 * (evita drift entre contadores y realidad).
 */
export function computeBatchMetrics(statuses: ReadonlyArray<LeadStatus>): BatchMetrics {
  const count = (s: LeadStatus) => statuses.filter((x) => x === s).length;
  const failedA = count(LeadStatus.FAILED);
  const aiReady = count(LeadStatus.AI_READY);
  const aiFailed = count(LeadStatus.AI_FAILED);
  const readyOnly = count(LeadStatus.READY);
  return {
    totalLeads: statuses.length,
    // "ready" = superó la Parte A. Un lead en AI_READY o AI_FAILED también superó la Parte A.
    readyCount: readyOnly + aiReady + aiFailed,
    failedCount: failedA,
    aiReadyCount: aiReady,
    aiFailedCount: aiFailed,
  };
}

/** ¿Están todos los leads en un estado terminal? Condición para completar el batch. */
export function allLeadsTerminal(statuses: ReadonlyArray<LeadStatus>, aiEnabled: boolean): boolean {
  return statuses.length > 0 && statuses.every((s) => isTerminalLeadStatus(s, aiEnabled));
}
