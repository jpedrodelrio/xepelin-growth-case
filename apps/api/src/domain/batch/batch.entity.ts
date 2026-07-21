import { InvalidTransitionError } from '@domain/shared/domain-error';
import { BatchMetrics } from './batch-metrics';
import { BatchStatus, canTransitionBatch } from './batch-status';

export interface BatchSnapshot {
  id: string;
  name: string;
  segment: string;
  ownerEmail: string;
  webhookUrl: string | null;
  status: BatchStatus;
  totalLeads: number;
  readyCount: number;
  failedCount: number;
  aiReadyCount: number;
  aiFailedCount: number;
}

/** Resumen que viaja en el payload del webhook cuando el batch se completa. */
export interface BatchSummary {
  total: number;
  ready: number;
  failed: number;
}

/**
 * Agregado Batch. Dueño de su ciclo de vida y de sus métricas.
 * Igual que Lead, sólo cambia de estado vía métodos que validan la transición.
 */
export class Batch {
  private constructor(private props: BatchSnapshot) {}

  static fromSnapshot(props: BatchSnapshot): Batch {
    return new Batch({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): BatchStatus {
    return this.props.status;
  }
  get webhookUrl(): string | null {
    return this.props.webhookUrl;
  }

  private transition(to: BatchStatus): void {
    if (!canTransitionBatch(this.props.status, to)) {
      throw new InvalidTransitionError('Batch', this.props.status, to);
    }
    this.props.status = to;
  }

  /** PENDING → PROCESSING. */
  startProcessing(): void {
    if (this.props.status === BatchStatus.PROCESSING) return; // idempotente
    this.transition(BatchStatus.PROCESSING);
  }

  /** PROCESSING → COMPLETED con métricas finales. */
  complete(metrics: BatchMetrics): void {
    this.transition(BatchStatus.COMPLETED);
    this.applyMetrics(metrics);
  }

  /** PROCESSING → FAILED (fallo fatal del procesamiento). */
  fail(): void {
    this.transition(BatchStatus.FAILED);
  }

  /** COMPLETED/FAILED → PROCESSING. Reabre el batch para reintentar leads fallidos. */
  reopen(): void {
    if (this.props.status === BatchStatus.PROCESSING) return;
    this.transition(BatchStatus.PROCESSING);
  }

  applyMetrics(metrics: BatchMetrics): void {
    this.props.totalLeads = metrics.totalLeads;
    this.props.readyCount = metrics.readyCount;
    this.props.failedCount = metrics.failedCount;
    this.props.aiReadyCount = metrics.aiReadyCount;
    this.props.aiFailedCount = metrics.aiFailedCount;
  }

  summary(): BatchSummary {
    return {
      total: this.props.totalLeads,
      ready: this.props.readyCount,
      failed: this.props.failedCount,
    };
  }

  toSnapshot(): BatchSnapshot {
    return { ...this.props };
  }
}
