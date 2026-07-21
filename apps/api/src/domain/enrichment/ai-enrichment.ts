/**
 * Salida estructurada del paso de AI-enrichment (Parte B).
 * El contrato de forma se garantiza con OpenAI Structured Outputs y se revalida con Zod
 * en el borde de infraestructura (defensa en profundidad). El dominio recibe ya un
 * objeto válido y sólo aplica invariantes de negocio.
 */
export interface AiEnrichmentResult {
  /** 0–100: qué tan buen prospecto es para Xepelin. */
  prospectFitScore: number;
  /** Justificación breve (1–2 frases) del score. */
  fitJustification: string;
  /** 1–2 frases personalizadas que el SDR usa para romper el hielo. */
  iceBreaker: string;
  /** Hipótesis del dolor más relevante (financiamiento / payments / gestión). */
  painHypothesis: string;
}

/** Invariante de negocio: el score debe estar en rango. Se usa como última red antes de persistir. */
export function assertValidFitScore(score: number): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error(`prospect_fit_score fuera de rango [0,100]: ${score}`);
  }
}
