/**
 * Estados de un Lead a lo largo del pipeline (Parte A + Parte B).
 *
 * Flujo feliz:
 *   PENDING → PROCESSING → READY → AI_ENRICHING → AI_READY
 *
 * Diagrama de flujo esperado (del caso):
 *   pending → processing → [validate → dedupe → contactability_enrich] → ready
 *           → ai_enriching → [public_info_fetch → llm_call → validate_output] → ai_ready
 *   Cualquier paso puede fallar y mover el lead a failed o ai_failed con error_reason.
 */
export enum LeadStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  AI_ENRICHING = 'AI_ENRICHING',
  AI_READY = 'AI_READY',
  AI_FAILED = 'AI_FAILED',
}

/**
 * Transiciones permitidas. Única fuente de verdad de la máquina de estados.
 * Cualquier movimiento fuera de este mapa lanza InvalidTransitionError.
 */
export const LEAD_TRANSITIONS: Readonly<Record<LeadStatus, ReadonlyArray<LeadStatus>>> = {
  [LeadStatus.PENDING]: [LeadStatus.PROCESSING],
  [LeadStatus.PROCESSING]: [LeadStatus.READY, LeadStatus.FAILED],
  [LeadStatus.READY]: [LeadStatus.AI_ENRICHING],
  [LeadStatus.AI_ENRICHING]: [LeadStatus.AI_READY, LeadStatus.AI_FAILED],
  // Estados terminales: sólo salen vía reset de reintento (ver Lead.resetForRetry()).
  [LeadStatus.FAILED]: [LeadStatus.PENDING],
  [LeadStatus.AI_FAILED]: [LeadStatus.PENDING],
  [LeadStatus.AI_READY]: [LeadStatus.PENDING],
};

/**
 * Estados terminales para efectos de completar el batch.
 * READY no es terminal cuando la Parte B está activa (siempre avanza a AI_ENRICHING);
 * lo incluimos para el caso en que el AI-enrichment esté deshabilitado por config.
 */
export function isTerminalLeadStatus(status: LeadStatus, aiEnabled: boolean): boolean {
  if (status === LeadStatus.FAILED || status === LeadStatus.AI_READY || status === LeadStatus.AI_FAILED) {
    return true;
  }
  if (status === LeadStatus.READY && !aiEnabled) {
    return true;
  }
  return false;
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}
