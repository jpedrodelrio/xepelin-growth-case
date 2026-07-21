import type { DomainFailure, FailureStage } from "./models.js";

export class PipelineError extends Error {
  readonly failure: DomainFailure;

  constructor(code: string, stage: FailureStage, message: string, retryable: boolean) {
    super(message);
    this.name = "PipelineError";
    this.failure = { code, stage, message, retryable };
  }
}

export function asPipelineError(error: unknown, stage: FailureStage): PipelineError {
  if (error instanceof PipelineError) return error;
  const message = error instanceof Error ? error.message : "Unknown pipeline error";
  return new PipelineError("unexpected_error", stage, message, true);
}
