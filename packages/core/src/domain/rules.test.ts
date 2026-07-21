import { describe, expect, it } from "vitest";
import { assertLeadTransition, calculateBatchSummary, normalizeLegalId } from "./rules.js";
import type { Lead } from "./models.js";

function lead(status: Lead["status"]): Lead {
  return {
    id: crypto.randomUUID(), batchId: "batch", legalId: "1", legalIdNormalized: "1",
    legalName: "Empresa SpA", website: "https://example.com", status, domain: null,
    normalizedName: null, websiteAlive: null, failure: null, aiEnrichment: null, aiExecution: null,
    publicInfo: null, attempts: 0, createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("domain rules", () => {
  it("normalizes Chilean and Mexican identifiers", () => {
    expect(normalizeLegalId("76.123.456-7")).toBe("761234567");
    expect(normalizeLegalId(" mage920101ab1 ")).toBe("MAGE920101AB1");
  });

  it("rejects invalid state transitions", () => {
    expect(() => assertLeadTransition("failed", "ai_ready")).toThrow(/Invalid lead transition/);
    expect(() => assertLeadTransition("pending", "processing")).not.toThrow();
  });

  it("summarizes AI terminal states as ready or failed", () => {
    expect(calculateBatchSummary([lead("ai_ready"), lead("failed"), lead("pending")])).toMatchObject({
      total: 3, ready: 1, failed: 1, pending: 1, readyPercentage: 33, failedPercentage: 33,
    });
  });
});
