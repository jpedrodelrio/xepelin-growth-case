// Eval del golden set del AI-enrichment.
// Corre el enricher (OpenAI) sobre casos con score esperado conocido y reporta calidad.
// Uso: pnpm eval:golden   (requiere AI_PROVIDER=openai + OPENAI_API_KEY en .env)
import type { Lead, PublicCompanyInfo } from "../packages/core/src/index.ts";
import { createAiProvider } from "../packages/infrastructure/src/factories.ts";
import goldenSet from "../fixtures/golden-set.json" with { type: "json" };

process.env.AI_PROVIDER = "openai";

interface GoldenCase {
  legalName: string;
  website: string | null;
  country: string;
  profile: string;
  expectedScoreBand: [number, number];
  expectedPain: string | null;
  icp: "alto" | "medio" | "bajo";
}

function buildLead(c: GoldenCase): Lead {
  const now = new Date();
  return {
    id: "golden", batchId: "golden", legalId: "sin-rut", legalIdNormalized: "SINRUT",
    legalName: c.legalName, website: c.website ?? "https://ejemplo.cl", status: "ai_enriching",
    domain: null, normalizedName: null, websiteAlive: null, failure: null,
    aiEnrichment: null, publicInfo: null, attempts: 0, createdAt: now, updatedAt: now,
  };
}

async function main(): Promise<void> {
  const cases = goldenSet.cases as GoldenCase[];
  const ai = createAiProvider("live");
  console.log(`\nGolden eval · ${cases.length} casos · modelo ${process.env.OPENAI_MODEL ?? "gpt-5-mini"}\n`);

  let schemaValid = 0;
  let inBand = 0;

  for (const c of cases) {
    const publicInfo: PublicCompanyInfo = {
      summary: `${c.legalName} (${c.country}). ${c.profile}.`,
      sources: [{ url: c.website ?? "https://ejemplo.cl", title: c.legalName, snippet: c.profile }],
    };
    const run = await ai.enrich(buildLead(c), publicInfo);
    const score = run.enrichment.prospectFitScore;
    const [lo, hi] = c.expectedScoreBand;
    const ok = typeof score === "number" && score >= lo && score <= hi;
    if (typeof score === "number") schemaValid += 1;
    if (ok) inBand += 1;
    console.log(`${ok ? "✓" : "✗"} [${c.icp.padEnd(5)}] ${c.legalName.padEnd(34)} score=${String(score).padStart(3)}  esperado ${lo}-${hi}`);
  }

  const n = cases.length;
  console.log(`\n── Resumen ──`);
  console.log(`schema_valid_rate : ${Math.round((schemaValid / n) * 100)}%`);
  console.log(`score_in_band     : ${Math.round((inBand / n) * 100)}%  (${inBand}/${n})`);
  if (inBand < n) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Eval falló:", error instanceof Error ? error.message : error);
  process.exit(1);
});
