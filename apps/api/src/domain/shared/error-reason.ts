/**
 * Taxonomía CERRADA de razones de fallo de un lead.
 *
 * Mantenerla como un conjunto cerrado (no strings libres) permite:
 *  - Agrupar y medir fallos en producción (¿cuántos leads mueren por sitio caído vs LLM?).
 *  - Decidir política de reintento por tipo (un `duplicate` no se reintenta; un `ai_llm_failed` sí).
 *  - Mostrar mensajes consistentes en la UI.
 */
export const ERROR_REASON = {
  // Validación (Parte A)
  INVALID_LEGAL_ID: 'invalid_legal_id',
  INVALID_WEBSITE: 'invalid_website',
  MISSING_WEBSITE: 'missing_website',
  // Deduplicación (Parte A)
  DUPLICATE: 'duplicate',
  // AI-enrichment (Parte B)
  AI_FETCH_FAILED: 'ai_fetch_failed',
  AI_LLM_FAILED: 'ai_llm_failed',
  AI_INVALID_OUTPUT: 'ai_invalid_output',
  AI_BUDGET_EXCEEDED: 'ai_budget_exceeded',
  // Fallback
  UNKNOWN: 'unknown_error',
} as const;

export type ErrorReason = (typeof ERROR_REASON)[keyof typeof ERROR_REASON];

/** Razones que NO tiene sentido reintentar (el reintento daría el mismo resultado). */
export const NON_RETRYABLE_REASONS: ReadonlySet<ErrorReason> = new Set([
  ERROR_REASON.DUPLICATE,
  ERROR_REASON.INVALID_LEGAL_ID,
  ERROR_REASON.INVALID_WEBSITE,
  ERROR_REASON.MISSING_WEBSITE,
]);
