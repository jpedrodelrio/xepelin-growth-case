import { describe, expect, it } from "vitest";
import { estimateAiCapacity } from "./ai-capacity.js";

describe("estimateAiCapacity", () => {
  it("estimates a 10K backfill with the current single-batch concurrency", () => {
    expect(estimateAiCapacity({
      companies: 10_000,
      serviceTimeMs: 12_000,
      concurrency: 5,
      averageTokensPerCompany: 854,
    })).toEqual({
      companies: 10_000,
      concurrency: 5,
      waves: 2_000,
      completionMinutes: 400,
      completionHours: 6.67,
      throughputPerMinute: 25,
      estimatedTokensPerMinute: 21_350,
    });
  });

  it("rejects invalid planning assumptions", () => {
    expect(() => estimateAiCapacity({
      companies: 10_000,
      serviceTimeMs: 0,
      concurrency: 5,
      averageTokensPerCompany: 854,
    })).toThrow(/serviceTimeMs/);
  });
});
