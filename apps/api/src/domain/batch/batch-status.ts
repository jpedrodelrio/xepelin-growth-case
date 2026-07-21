export enum BatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Transiciones del batch.
 *   PENDING → PROCESSING        (empieza a procesarse)
 *   PROCESSING → COMPLETED       (todos los leads en estado terminal)
 *   PROCESSING → FAILED          (fallo fatal del procesamiento)
 *   COMPLETED/FAILED → PROCESSING (reintento de fallidos reabre el batch)
 */
export const BATCH_TRANSITIONS: Readonly<Record<BatchStatus, ReadonlyArray<BatchStatus>>> = {
  [BatchStatus.PENDING]: [BatchStatus.PROCESSING],
  [BatchStatus.PROCESSING]: [BatchStatus.COMPLETED, BatchStatus.FAILED],
  [BatchStatus.COMPLETED]: [BatchStatus.PROCESSING],
  [BatchStatus.FAILED]: [BatchStatus.PROCESSING],
};

export function canTransitionBatch(from: BatchStatus, to: BatchStatus): boolean {
  return BATCH_TRANSITIONS[from].includes(to);
}
