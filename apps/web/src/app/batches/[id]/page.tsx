import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RetryButton } from "@/components/retry-button";
import { getBatch, type LeadItem } from "@/lib/api";

export const dynamic = "force-dynamic";

function AiFitCell({ enrichment }: { enrichment: NonNullable<LeadItem["aiEnrichment"]> }) {
  return (
    <div className="fitCell">
      <div className="score">{enrichment.prospectFitScore}</div>
      <div className="meta">Confianza {enrichment.confidence}</div>
      <div className="fitJustification">{enrichment.fitJustification}</div>
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

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) notFound();
  return (
    <AppShell><main className="container">
      <Link className="back" href="/batches">← Todos los batches</Link>
      <div className="headerRow"><div><div className="eyebrow">{batch.segment}</div><h1>{batch.name}</h1><p className="subtitle">Owner: {batch.ownerEmail}</p></div><RetryButton batchId={batch.id} /></div>
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
          <td>{lead.aiEnrichment ? <AiFitCell enrichment={lead.aiEnrichment} /> : "—"}</td>
          <td><LeadOutcomeCell lead={lead} /></td>
        </tr>)}</tbody></table></section>
      <h2 className="sectionTitle">Entregas del webhook</h2>
      <section className="surface deliveries">{batch.webhookDeliveries.length === 0 ? <div className="meta">Aún no hay intentos.</div> : batch.webhookDeliveries.map((delivery) => <div className="delivery" key={delivery.id}><span>Intento #{delivery.attempt} · {new Date(delivery.createdAt).toLocaleString("es-CL")}</span><span>{delivery.statusCode ?? delivery.error}</span></div>)}</section>
    </main></AppShell>
  );
}
