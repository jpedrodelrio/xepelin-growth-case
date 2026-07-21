export interface AiCapacityAssumptions {
  companies: number;
  serviceTimeMs: number;
  concurrency: number;
  averageTokensPerCompany: number;
}

export interface AiCapacityEstimate {
  companies: number;
  concurrency: number;
  waves: number;
  completionMinutes: number;
  completionHours: number;
  throughputPerMinute: number;
  estimatedTokensPerMinute: number;
}

export function estimateAiCapacity(input: AiCapacityAssumptions): AiCapacityEstimate {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
  }

  const waves = Math.ceil(input.companies / input.concurrency);
  const completionMinutes = (waves * input.serviceTimeMs) / 60_000;
  const throughputPerMinute = (input.concurrency * 60_000) / input.serviceTimeMs;

  return {
    companies: input.companies,
    concurrency: input.concurrency,
    waves,
    completionMinutes: Number(completionMinutes.toFixed(2)),
    completionHours: Number((completionMinutes / 60).toFixed(2)),
    throughputPerMinute: Number(throughputPerMinute.toFixed(2)),
    estimatedTokensPerMinute: Math.round(throughputPerMinute * input.averageTokensPerCompany),
  };
}
