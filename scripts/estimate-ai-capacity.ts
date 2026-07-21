import { estimateAiCapacity } from "../packages/core/src/domain/ai-capacity.ts";

const observedAiLatencyMs = [5_525, 8_670];
const planningServiceTimeMs = 12_000;
const averageTokensPerCompany = 854;

const report = {
  evidence: {
    samples: observedAiLatencyMs.length,
    observedAiLatencyMs,
    planningServiceTimeMs,
    rationale: "10s conservative AI stage + 2s website, queue and persistence overhead",
  },
  monthlyBackfillSingleBatch: estimateAiCapacity({
    companies: 10_000,
    serviceTimeMs: planningServiceTimeMs,
    concurrency: 5,
    averageTokensPerCompany,
  }),
  steadyQueueTwoActiveBatches: estimateAiCapacity({
    companies: 10_000,
    serviceTimeMs: planningServiceTimeMs,
    concurrency: 10,
    averageTokensPerCompany,
  }),
  dailyAverageSingleBatch: estimateAiCapacity({
    companies: 334,
    serviceTimeMs: planningServiceTimeMs,
    concurrency: 5,
    averageTokensPerCompany,
  }),
  caveat: "Two observations support a capacity estimate, not a production p95. Instrument at least 100 live runs before setting the SLO.",
};

console.log(JSON.stringify(report, null, 2));
