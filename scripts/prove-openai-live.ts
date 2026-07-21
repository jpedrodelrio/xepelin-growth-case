import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Lead } from "../packages/core/src/index.ts";
import {
  DemoPublicInfoProvider,
  OpenAiEnrichmentProvider,
} from "../packages/infrastructure/src/providers.ts";

const confirmationFlag = "--confirm-live-call";
const model = process.env.OPENAI_MODEL ?? "gpt-5-mini-2025-08-07";
const configuredLimit = Number(process.env.OPENAI_PROOF_MAX_OUTPUT_TOKENS ?? "1200");

if (!Number.isInteger(configuredLimit) || configuredLimit < 200 || configuredLimit > 1_200) {
  throw new Error("OPENAI_PROOF_MAX_OUTPUT_TOKENS must be an integer between 200 and 1200");
}

if (!process.argv.includes(confirmationFlag)) {
  console.log(
    JSON.stringify(
      {
        willCallApi: false,
        model,
        leads: 1,
        publicInfoProvider: "demo (no paid search)",
        maxOutputTokens: configuredLimit,
        safeguard: `Run again with ${confirmationFlag} only after confirming promotional API credit.`,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (process.env.OPENAI_FREE_CREDIT_CONFIRMED !== "true") {
  throw new Error(
    "Live call blocked: verify the API billing page and set OPENAI_FREE_CREDIT_CONFIRMED=true only if promotional credit is available.",
  );
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("Live call blocked: OPENAI_API_KEY is missing from the local .env file");
}

const lead: Lead = {
  id: "proof-openai-live-001",
  batchId: "proof-batch-001",
  legalId: "76.123.456-7",
  legalIdNormalized: "761234567",
  legalName: "Comercializadora Andes SpA",
  website: "https://comercializadoraandes.cl",
  status: "ai_enriching",
  domain: "comercializadoraandes.cl",
  normalizedName: "comercializadora andes spa",
  websiteAlive: true,
  failure: null,
  aiEnrichment: null,
  aiExecution: null,
  publicInfo: null,
  attempts: 1,
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
};

async function main(): Promise<void> {
  const publicInfo = await new DemoPublicInfoProvider().fetch(lead);
  const provider = new OpenAiEnrichmentProvider(apiKey, model, configuredLimit);
  const run = await provider.enrichWithEvidence(lead, publicInfo);
  const usage = run.execution.usage;

  const proof = {
    proofType: "openai_responses_api_structured_output",
    provider: "OpenAI",
    executedAt: new Date().toISOString(),
    billingContext: "user_confirmed_promotional_api_credit",
    containsSecrets: false,
    input: {
      leadId: lead.id,
      legalName: lead.legalName,
      evidenceKind: "synthetic_demo_fixture",
      publicInfoProvider: "DemoPublicInfoProvider",
    },
    api: {
      ...run.execution,
      pricingAssumptionUsdPerMillionTokens: { input: 0.25, output: 2 },
      pricingSource: "https://developers.openai.com/api/docs/models/gpt-5-mini",
    },
    schemaValidated: true,
    output: run.enrichment,
  };

  const evidenceDirectory = resolve("docs/evidence");
  const evidencePath = resolve(evidenceDirectory, "openai-live-proof.json");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        success: true,
        responseId: run.execution.responseId,
        model: run.execution.model,
        usage,
        estimatedCostUsd: run.execution.estimatedCostUsd,
        evidencePath,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenAI proof error";
  console.error(message);
  process.exitCode = 1;
});
