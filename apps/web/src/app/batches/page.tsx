import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BatchActions } from "@/components/batch-actions";
import { getBatches, getProviderCapabilities } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const [batches, capabilities] = await Promise.all([getBatches(), getProviderCapabilities()]);
  return (
    <AppShell>
      <main className="container">
        <div className="headerRow">
          <div><div className="eyebrow">Pipeline pre-enrolamiento</div><h1>Batches de outbound</h1><p className="subtitle">Pipeline asíncrono, observable y tolerante a fallos parciales.</p></div>
          <BatchActions capabilities={capabilities} />
        </div>
        <section className="surface tableWrap">
          {batches.length === 0 ? <div className="empty">No hay batches todavía. Ejecuta el payload sintético del caso.</div> : (
            <table><thead><tr><th>Batch</th><th>Modo</th><th>Segmento</th><th>Owner</th><th>Fecha</th><th>Estado</th><th>Ready</th><th>Failed</th></tr></thead>
              <tbody>{batches.map((batch) => <tr key={batch.id}>
                <td><Link className="nameLink" href={`/batches/${batch.id}`}>{batch.name}</Link><div className="meta">{batch.summary.total} leads</div></td>
                <td><span className={`providerBadge ${batch.executionMode}`}>{batch.executionMode}</span></td>
                <td>{batch.segment}</td><td>{batch.ownerEmail}</td><td>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.createdAt))}</td>
                <td><span className={`badge ${batch.status}`}>{batch.status}</span></td>
                <td>{batch.summary.readyPercentage}%<div className="progress"><span style={{ width: `${batch.summary.readyPercentage}%` }} /></div></td>
                <td>{batch.summary.failedPercentage}%</td>
              </tr>)}</tbody>
            </table>
          )}
        </section>
      </main>
    </AppShell>
  );
}
