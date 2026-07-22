import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeadCard } from "@/components/lead-card";
import { LiveBatchRefresh } from "@/components/live-batch-refresh";
import { PipelineEvents } from "@/components/pipeline-events";
import { RetryButton } from "@/components/retry-button";
import { getBatch, type BatchDetail } from "@/lib/api";
import { calculateBatchTimings, formatDuration } from "@/lib/timing";

export const dynamic = "force-dynamic";

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
  const timings = calculateBatchTimings(batch);
  const leadRange = timings.minLeadDurationMs === null || timings.maxLeadDurationMs === null
    ? "—"
    : `${formatDuration(timings.minLeadDurationMs)}–${formatDuration(timings.maxLeadDurationMs)}`;
  const isActive = batch.status === "pending" || batch.status === "processing";
  return (
    <AppShell><main className="container">
      <Link className="back" href="/batches">← Todos los batches</Link>
      <div className="headerRow">
        <div><div className="eyebrow">{batch.segment} · {batch.executionMode}</div><h1>{batch.name}</h1><p className="subtitle">Owner: {batch.ownerEmail}</p></div>
        <div className="batchActions"><LiveBatchRefresh active={isActive} /><RetryButton batchId={batch.id} /></div>
      </div>
      <div className="stats">
        <div className="stat"><div className="statLabel">Total</div><div className="statValue">{batch.summary.total}</div></div>
        <div className="stat"><div className="statLabel">Ready</div><div className="statValue">{batch.summary.ready}</div></div>
        <div className="stat"><div className="statLabel">Failed</div><div className="statValue">{batch.summary.failed}</div></div>
        <div className="stat"><div className="statLabel">Estado</div><div style={{ marginTop: 10 }}><span className={`badge ${batch.status}`}>{batch.status}</span></div></div>
        <div className="stat"><div className="statLabel">Duración batch</div><div className="statValue statValueCompact">{formatDuration(timings.batchDurationMs)}</div></div>
        <div className="stat"><div className="statLabel">Promedio por lead</div><div className="statValue statValueCompact">{formatDuration(timings.averageLeadDurationMs)}</div></div>
        <div className="stat"><div className="statLabel">Rango de leads</div><div className="statValue statValueCompact">{leadRange}</div></div>
      </div>
      <PipelineEvents events={batch.events} leads={batch.leads} />
      <h2 className="sectionTitle">Leads</h2>
      <div className="leadList">
        {batch.leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            durationMs={timings.leadDurationById[lead.id] ?? null}
            defaultExpanded={batch.leads.length === 1}
          />
        ))}
      </div>
      <h2 className="sectionTitle">Entregas del webhook</h2>
      <section className="surface deliveries">{batch.webhookDeliveries.length === 0 ? <div className="meta">Aún no hay intentos.</div> : batch.webhookDeliveries.map((delivery) => <WebhookDeliveryLog batchId={batch.id} delivery={delivery} key={delivery.id} />)}</section>
    </main></AppShell>
  );
}
