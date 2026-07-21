import fixture from "../fixtures/llm-evaluation-batches.json" with { type: "json" };

interface BatchPayload {
  name: string;
  segment: string;
  owner_email: string;
  webhook_url: string;
  leads: Array<{ legal_id: string; legal_name: string; website: string }>;
}

interface Scenario {
  id: string;
  description: string;
  expected_ai_calls: number;
  payload: BatchPayload;
}

interface BatchDetail {
  id: string;
  name: string;
  status: string;
  summary: { total: number; ready: number; failed: number; pending: number };
  leads: Array<{
    legalName: string;
    status: string;
    failure: { code: string; stage: string; message: string; retryable: boolean } | null;
    publicInfo: { sources: Array<{ title: string; url: string }> } | null;
    aiEnrichment: {
      prospectFitScore: number;
      fitJustification: string;
      iceBreaker: string;
      painHypothesis: string;
      confidence: string;
      evidence: string[];
    } | null;
    aiExecution: {
      mode: "demo" | "live";
      model: string | null;
      latencyMs: number;
      usage: { totalTokens: number } | null;
      estimatedCostUsd: number | null;
    } | null;
  }>;
  webhookDeliveries: Array<{
    mode: "demo" | "live" | "unknown";
    attempt: number;
    statusCode: number | null;
    error: string | null;
    createdAt: string;
  }>;
}

const suite = fixture as { scenarios: Scenario[] };
const args = process.argv.slice(2);
const confirmCreate = args.includes("--confirm-create");
const noWait = args.includes("--no-wait");
const scenarioId = readArgument("--scenario");
const apiUrl = (process.env.API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
const webUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const webhookUrl = process.env.WEBHOOK_URL;
const scenarios = scenarioId
  ? suite.scenarios.filter((scenario) => scenario.id === scenarioId)
  : suite.scenarios;

if (scenarios.length === 0) {
  throw new Error(`Unknown scenario "${scenarioId}". Available: ${suite.scenarios.map((scenario) => scenario.id).join(", ")}`);
}

const expectedAiCalls = scenarios.reduce((total, scenario) => total + scenario.expected_ai_calls, 0);
const plan = {
  mode: confirmCreate ? "create" : "dry-run",
  apiUrl,
  scenarios: scenarios.map(({ id, description, expected_ai_calls, payload }) => ({
    id,
    description,
    leads: payload.leads.length,
    expectedAiCalls: expected_ai_calls,
  })),
  expectedAiCalls,
  estimatedLiveCostUsd: Number((expectedAiCalls * 0.001134).toFixed(6)),
  note: "The estimate uses the previous 854-token live execution; actual usage varies.",
};

async function main(): Promise<void> {
  console.log(JSON.stringify(plan, null, 2));
  if (!confirmCreate) {
    console.log("Dry-run only. Add --confirm-create to POST the selected synthetic batches.");
    return;
  }

  for (const scenario of scenarios) {
    const payload = {
      ...scenario.payload,
      webhook_url: webhookUrl ?? scenario.payload.webhook_url,
    };
    const response = await fetch(`${apiUrl}/batches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Scenario ${scenario.id}: API returned ${response.status}: ${await response.text()}`);

    const created = await response.json() as { id: string };
    console.log(JSON.stringify({ event: "batch_created", scenario: scenario.id, batchId: created.id, detailUrl: `${webUrl}/batches/${created.id}` }));
    if (noWait) continue;

    const detail = await waitForTerminalBatch(created.id);
    console.log(JSON.stringify(summarizeScenario(scenario.id, detail), null, 2));
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function readArgument(name: string): string | undefined {
  const direct = args.find((argument) => argument.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function waitForTerminalBatch(batchId: string): Promise<BatchDetail> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${apiUrl}/batches/${batchId}`);
    if (!response.ok) throw new Error(`Batch ${batchId}: detail returned ${response.status}`);
    const detail = await response.json() as BatchDetail;
    if (["completed", "failed"].includes(detail.status)) return detail;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Batch ${batchId} did not reach a terminal status within 180 seconds`);
}

function summarizeScenario(scenario: string, detail: BatchDetail) {
  const estimatedCostUsd = detail.leads.reduce(
    (total, lead) => total + (lead.aiExecution?.estimatedCostUsd ?? 0),
    0,
  );
  return {
    event: "batch_completed",
    scenario,
    batchId: detail.id,
    detailUrl: `${webUrl}/batches/${detail.id}`,
    status: detail.status,
    summary: detail.summary,
    ai: {
      liveExecutions: detail.leads.filter((lead) => lead.aiExecution?.mode === "live").length,
      totalTokens: detail.leads.reduce((total, lead) => total + (lead.aiExecution?.usage?.totalTokens ?? 0), 0),
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
    },
    leads: detail.leads.map((lead) => ({
      company: lead.legalName,
      status: lead.status,
      errorReason: lead.failure?.code ?? null,
      publicSources: lead.publicInfo?.sources.map((source) => source.title) ?? [],
      score: lead.aiEnrichment?.prospectFitScore ?? null,
      confidence: lead.aiEnrichment?.confidence ?? null,
      justification: lead.aiEnrichment?.fitJustification ?? null,
      iceBreaker: lead.aiEnrichment?.iceBreaker ?? null,
      painHypothesis: lead.aiEnrichment?.painHypothesis ?? null,
      model: lead.aiExecution?.model ?? null,
      latencyMs: lead.aiExecution?.latencyMs ?? null,
      tokens: lead.aiExecution?.usage?.totalTokens ?? null,
    })),
    webhookDeliveries: detail.webhookDeliveries,
  };
}
