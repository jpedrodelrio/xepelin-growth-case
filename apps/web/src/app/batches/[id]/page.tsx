import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RetryButton } from "@/components/retry-button";
import { getBatch, type AiExecutionMetadata, type BatchDetail, type LeadItem } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatCost(value: number | null): string {
  if (value === null) return "No calculado";
  if (value === 0) return "USD 0";
  return `USD ${value.toFixed(6)}`;
}

function AiExecutionDetails({ execution }: { execution: AiExecutionMetadata | null }) {
  if (!execution) return <div className="aiRunLegacy">Sin telemetría · batch anterior</div>;
  const isLive = execution.mode === "live";
  return (
    <div className={`aiRunCard ${execution.mode}`}>
      <div className="aiRunHeader">
        <span className={`providerBadge ${execution.mode}`}>{isLive ? "LLM real" : "Demo"}</span>
        <strong>{execution.provider}</strong>
      </div>
      <div className="aiRunModel">{execution.model ?? "Modelo no informado"}</div>
      <details className="aiRunDetails">
        <summary>Ver ejecución</summary>
        <dl>
          <div><dt>Tokens</dt><dd>{execution.usage?.totalTokens ?? "—"}</dd></div>
          <div><dt>Latencia</dt><dd>{(execution.latencyMs / 1_000).toFixed(2)} s</dd></div>
          <div><dt>Costo est.</dt><dd>{formatCost(execution.estimatedCostUsd)}</dd></div>
          <div><dt>Reasoning</dt><dd>{execution.usage?.reasoningTokens ?? "—"}</dd></div>
        </dl>
        {execution.responseId && <div className="responseId"><span>Response ID</span><code>{execution.responseId}</code></div>}
        <div className="aiRunTimestamp">{new Date(execution.completedAt).toLocaleString("es-CL")}</div>
      </details>
    </div>
  );
}

function AiFitCell({ enrichment, execution }: { enrichment: NonNullable<LeadItem["aiEnrichment"]>; execution: AiExecutionMetadata | null }) {
  return (
    <div className="fitCell">
      <div className="score">{enrichment.prospectFitScore}</div>
      <div className="meta">Confianza {enrichment.confidence}</div>
      <div className="fitJustification">{enrichment.fitJustification}</div>
      <AiExecutionDetails execution={execution} />
    </div>
  );
}

function LeadOutcomeCell({ lead }: { lead: LeadItem }) {
  if (lead.failure) {
    return (
      <div className="error">
        <strong>{lead.failure.code}</strong><br />
        {lead.failure.message}
        <div className="meta">{lead.failure.retryable ? "Reintentable" : "Permanente"}</div>
      </div>
    );
  }

  if (!lead.aiEnrichment) return <>Procesando…</>;

  return (
    <div className="aiText">
      {lead.aiEnrichment.iceBreaker}
      <div className="meta painHypothesis">{lead.aiEnrichment.painHypothesis}</div>
      <div className="evidenceTitle">Evidencia usada</div>
      <ul className="evidenceList">
        {lead.aiEnrichment.evidence.slice(0, 2).map((evidence) => <li key={evidence}>{evidence}</li>)}
      </ul>
    </div>
  );
}

function WebhookModeBadge({ mode }: { mode: BatchDetail["webhookDeliveries"][number]["mode"] }) {
  const label = mode === "live" ? "Webhook real" : mode === "demo" ? "Demo" : "Sin telemetría";
  return <span className={`providerBadge ${mode}`}>{label}</span>;
}

function WebhookDeliveryLog({
  batchId,
  delivery,
}: {
  batchId: string;
  delivery: BatchDetail["webhookDeliveries"][number];
}) {
  const event = delivery.error ? "webhook_delivery_failed" : "webhook_delivery_succeeded";
  const idempotencyKey = `batch:${batchId}:completed`;
  const log = {
    event,
    timestamp: delivery.createdAt,
    batchId,
    deliveryId: delivery.id,
    mode: delivery.mode,
    attempt: delivery.attempt,
    statusCode: delivery.statusCode,
    error: delivery.error,
    idempotencyKey,
  };

  return (
    <article className={`delivery ${delivery.error ? "failed" : "succeeded"}`}>
      <div className="deliverySummary">
        <div className="deliveryInfo">
          <WebhookModeBadge mode={delivery.mode} />
          <span>Intento #{delivery.attempt}</span>
          <span className="deliveryTimestamp">{new Date(delivery.createdAt).toLocaleString("es-CL")}</span>
        </div>
        <span className={`deliveryStatus ${delivery.error ? "failed" : "succeeded"}`}>
          {delivery.statusCode === null ? "Sin respuesta HTTP" : `HTTP ${delivery.statusCode}`}
        </span>
      </div>
      <details className="webhookLogDetails">
        <summary>Ver log del webhook</summary>
        <dl className="webhookLogMetadata">
          <div><dt>Evento</dt><dd>{event}</dd></div>
          <div><dt>Batch ID</dt><dd><code>{batchId}</code></dd></div>
          <div><dt>Delivery ID</dt><dd><code>{delivery.id}</code></dd></div>
          <div><dt>Idempotency-Key</dt><dd><code>{idempotencyKey}</code></dd></div>
        </dl>
        {delivery.error && <div className="webhookLogError"><strong>Error:</strong> {delivery.error}</div>}
        <pre className="webhookLogRaw"><code>{JSON.stringify(log, null, 2)}</code></pre>
      </details>
    </article>
  );
}

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) notFound();
  return (
    <AppShell><main className="container">
      <Link className="back" href="/batches">← Todos los batches</Link>
      <div className="headerRow"><div><div className="eyebrow">{batch.segment} · {batch.executionMode}</div><h1>{batch.name}</h1><p className="subtitle">Owner: {batch.ownerEmail}</p></div><RetryButton batchId={batch.id} /></div>
      <div className="stats">
        <div className="stat"><div className="statLabel">Total</div><div className="statValue">{batch.summary.total}</div></div>
        <div className="stat"><div className="statLabel">Ready</div><div className="statValue">{batch.summary.ready}</div></div>
        <div className="stat"><div className="statLabel">Failed</div><div className="statValue">{batch.summary.failed}</div></div>
        <div className="stat"><div className="statLabel">Estado</div><div style={{ marginTop: 10 }}><span className={`badge ${batch.status}`}>{batch.status}</span></div></div>
      </div>
      <section className="surface tableWrap"><table><thead><tr><th>Empresa</th><th>Estado</th><th>Contactabilidad</th><th>AI fit</th><th>Ice-breaker / error</th></tr></thead>
        <tbody>{batch.leads.map((lead) => <tr key={lead.id}>
          <td><div className="nameLink">{lead.legalName}</div><div className="meta">{lead.legalId}</div><div className="meta">{lead.website || "Sin website"}</div></td>
          <td><span className={`badge ${lead.status}`}>{lead.status}</span></td>
          <td><div>{lead.domain ?? "—"}</div><div className="meta">Website: {lead.websiteAlive === null ? "—" : lead.websiteAlive ? "vivo" : "no disponible"}</div></td>
          <td>{lead.aiEnrichment ? <AiFitCell enrichment={lead.aiEnrichment} execution={lead.aiExecution} /> : "—"}</td>
          <td><LeadOutcomeCell lead={lead} /></td>
        </tr>)}</tbody></table></section>
      <h2 className="sectionTitle">Entregas del webhook</h2>
      <section className="surface deliveries">{batch.webhookDeliveries.length === 0 ? <div className="meta">Aún no hay intentos.</div> : batch.webhookDeliveries.map((delivery) => <WebhookDeliveryLog batchId={batch.id} delivery={delivery} key={delivery.id} />)}</section>
    </main></AppShell>
  );
}
