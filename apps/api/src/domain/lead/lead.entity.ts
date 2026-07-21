import { InvalidTransitionError } from '@domain/shared/domain-error';
import { ErrorReason } from '@domain/shared/error-reason';
import { ContactabilityResult } from '@domain/enrichment/contactability';
import { AiEnrichmentResult, assertValidFitScore } from '@domain/enrichment/ai-enrichment';
import { canTransition, LeadStatus } from './lead-status';

/** Representación plana del lead para persistencia (mapeada desde/hacia Prisma). */
export interface LeadSnapshot {
  id: string;
  batchId: string;
  position: number;
  legalId: string;
  legalIdNormalized: string;
  legalName: string;
  website: string | null;
  status: LeadStatus;
  errorReason: ErrorReason | null;
  domain: string | null;
  normalizedName: string | null;
  websiteAlive: boolean | null;
  prospectFitScore: number | null;
  fitJustification: string | null;
  iceBreaker: string | null;
  painHypothesis: string | null;
}

/**
 * Agregado Lead. Encapsula la máquina de estados del pipeline.
 *
 * Regla clave: NINGÚN cambio de estado ocurre asignando `status` directamente. Todo pasa
 * por un método (startProcessing, markReady, ...) que valida la transición contra
 * LEAD_TRANSITIONS. Así el estado inválido es *irrepresentable* desde el dominio, y las
 * reglas quedan testeables sin base de datos, sin colas y sin LLM.
 */
export class Lead {
  private constructor(private props: LeadSnapshot) {}

  static fromSnapshot(props: LeadSnapshot): Lead {
    return new Lead({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get batchId(): string {
    return this.props.batchId;
  }
  get position(): number {
    return this.props.position;
  }
  get status(): LeadStatus {
    return this.props.status;
  }
  get legalId(): string {
    return this.props.legalId;
  }
  get legalIdNormalized(): string {
    return this.props.legalIdNormalized;
  }
  get legalName(): string {
    return this.props.legalName;
  }
  get website(): string | null {
    return this.props.website;
  }
  get domain(): string | null {
    return this.props.domain;
  }
  get errorReason(): ErrorReason | null {
    return this.props.errorReason;
  }

  // ─────────────────────────── Máquina de estados ───────────────────────────

  private transition(to: LeadStatus): void {
    if (!canTransition(this.props.status, to)) {
      throw new InvalidTransitionError('Lead', this.props.status, to);
    }
    this.props.status = to;
  }

  /** PENDING → PROCESSING. Inicio del pipeline. */
  startProcessing(): void {
    this.transition(LeadStatus.PROCESSING);
  }

  /** PROCESSING → READY. Pasó validación + dedupe; guarda contactabilidad. */
  markReady(contactability: ContactabilityResult): void {
    this.transition(LeadStatus.READY);
    this.props.domain = contactability.domain;
    this.props.normalizedName = contactability.normalizedName;
    this.props.websiteAlive = contactability.websiteAlive;
    this.props.errorReason = null;
  }

  /** PROCESSING → FAILED. Falla de validación o dedupe. */
  markFailed(reason: ErrorReason): void {
    this.transition(LeadStatus.FAILED);
    this.props.errorReason = reason;
  }

  /** READY → AI_ENRICHING. Arranca la Parte B. */
  startAiEnriching(): void {
    this.transition(LeadStatus.AI_ENRICHING);
  }

  /** AI_ENRICHING → AI_READY. Guarda la salida validada del LLM. */
  markAiReady(ai: AiEnrichmentResult): void {
    assertValidFitScore(ai.prospectFitScore);
    this.transition(LeadStatus.AI_READY);
    this.props.prospectFitScore = ai.prospectFitScore;
    this.props.fitJustification = ai.fitJustification;
    this.props.iceBreaker = ai.iceBreaker;
    this.props.painHypothesis = ai.painHypothesis;
    this.props.errorReason = null;
  }

  /**
   * AI_ENRICHING → AI_FAILED. El lead sigue siendo usable por el SDR (ya está enriquecido
   * en contactabilidad); sólo perdió el enriquecimiento con IA. Degradación elegante.
   */
  markAiFailed(reason: ErrorReason): void {
    this.transition(LeadStatus.AI_FAILED);
    this.props.errorReason = reason;
  }

  /**
   * Reinicia un lead en estado terminal a PENDING para reprocesarlo (retry-failed).
   * Limpia error y outputs previos. Idempotente: si ya está PENDING no hace nada.
   */
  resetForRetry(): void {
    if (this.props.status === LeadStatus.PENDING) return;
    this.transition(LeadStatus.PENDING);
    this.props.errorReason = null;
  }

  toSnapshot(): LeadSnapshot {
    return { ...this.props };
  }
}
