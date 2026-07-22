"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProviderCapabilities } from "@/lib/api";

const MAX_COMPANIES = 5;
const COST_CEILING_PER_LEAD = 0.01;

// Metadatos sintéticos; la URL del webhook siempre debe ingresarla el usuario.
const LIVE_DEFAULTS = {
  segment: "pyme_servicios",
  owner_email: "growth.synthetic@xepelin.com",
};

interface CompanyRow {
  legalName: string;
  website: string;
  legalId: string;
}

const emptyRow = (): CompanyRow => ({ legalName: "", website: "", legalId: "" });

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function BatchActions({ capabilities }: { capabilities: ProviderCapabilities }) {
  const [creating, setCreating] = useState<"demo" | "live" | null>(null);
  const [error, setError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>([emptyRow()]);
  const router = useRouter();

  async function postBatch(payload: unknown) {
    const response = await fetch("/api/growth/batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`La API respondió ${response.status}`);
    const batch = (await response.json()) as { id: string };
    router.push(`/batches/${batch.id}`);
  }

  async function createDemo() {
    setCreating("demo");
    setError("");
    try {
      const fixture = await fetch("/demo-batch.json").then((r) => {
        if (!r.ok) throw new Error("No fue posible cargar el fixture demo");
        return r.json();
      });
      await postBatch(fixture);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el batch");
      setCreating(null);
    }
  }

  function updateCompany(index: number, field: keyof CompanyRow, value: string) {
    setCompanies((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  function addCompany() {
    setCompanies((rows) => (rows.length >= MAX_COMPANIES ? rows : [...rows, emptyRow()]));
  }
  function removeCompany(index: number) {
    setCompanies((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  const filled = companies.filter((company) => company.legalName.trim() !== "");
  const activeCount = Math.max(1, filled.length);
  const estCost = (activeCount * COST_CEILING_PER_LEAD).toFixed(2).replace(".", ",");

  async function createLive() {
    if (!isHttpUrl(webhookUrl.trim())) {
      setError("Ingresa una URL de webhook válida (http/https).");
      return;
    }
    if (filled.length === 0) {
      setError("Agrega al menos una empresa (razón social + sitio web).");
      return;
    }
    if (filled.some((company) => !isHttpUrl(company.website.trim()))) {
      setError("Cada empresa necesita un sitio web válido (http/https).");
      return;
    }
    setCreating("live");
    setError("");
    try {
      const payload = {
        name: filled.length === 1 ? `Prueba real · ${filled[0].legalName.trim()}` : `Prueba real · ${filled.length} empresas`,
        segment: LIVE_DEFAULTS.segment,
        owner_email: LIVE_DEFAULTS.owner_email,
        webhook_url: webhookUrl.trim(),
        execution_mode: "live",
        leads: filled.map((company, index) => ({
          // RUT opcional: placeholder ÚNICO por empresa (evita falsos duplicados en el dedup intra-batch).
          legal_id: company.legalId.trim() || `sin-rut-${index + 1}`,
          legal_name: company.legalName.trim(),
          website: company.website.trim(),
        })),
      };
      await postBatch(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el batch");
      setCreating(null);
    }
  }

  const liveSource = capabilities.publicInfo.source === "brave" ? "Brave Search" : "Wikipedia";
  const liveDisabled = creating !== null || !capabilities.liveResearchReady;
  const demoDisabled = creating !== null || !capabilities.demoReady;

  return (
    <div className="createCard">
      <div className="createHead"><h3>Nuevo batch</h3></div>

      <div className="createSec">
        <div className="demoRow">
          <div>
            <div className="demoT">Demo reproducible</div>
            <div className="demoS">20 leads sintéticos del Anexo A · sin credenciales</div>
          </div>
          <button type="button" className="button buttonSecondary" disabled={demoDisabled} onClick={createDemo}>
            {creating === "demo" ? "Creando…" : "Ejecutar demo"}
          </button>
        </div>
      </div>

      <div className="createDiv" />

      <div className="createSec">
        <p className="createLbl">Prueba real · una o varias empresas</p>

        <input
          className="createInput createWhk"
          type="url"
          aria-label="URL del webhook"
          placeholder="Webhook.site URL (https://webhook.site/…) · uno para todo el batch"
          value={webhookUrl}
          onChange={(event) => setWebhookUrl(event.target.value)}
          disabled={liveDisabled}
        />

        <p className="createLbl createLblSm">Empresas <span className="createCnt">({companies.length} / {MAX_COMPANIES})</span></p>
        <div className="companyRows">
          {companies.map((row, index) => (
            <div className="companyRow" key={index}>
              <input className="createInput" placeholder="Razón social (ej. Rhona S.A.)" value={row.legalName} onChange={(event) => updateCompany(index, "legalName", event.target.value)} disabled={liveDisabled} />
              <input className="createInput" type="url" placeholder="Sitio web (https://…)" value={row.website} onChange={(event) => updateCompany(index, "website", event.target.value)} disabled={liveDisabled} />
              <input className="createInput" placeholder="RUT (opcional)" value={row.legalId} onChange={(event) => updateCompany(index, "legalId", event.target.value)} disabled={liveDisabled} />
              <button type="button" className="companyRm" onClick={() => removeCompany(index)} disabled={liveDisabled || companies.length <= 1} aria-label="Quitar empresa">×</button>
            </div>
          ))}
        </div>
        <button type="button" className="companyAdd" onClick={addCompany} disabled={liveDisabled || companies.length >= MAX_COMPANIES}>
          + Agregar empresa
        </button>

        <div className="createFoot">
          <span className={`createReady ${capabilities.liveResearchReady ? "" : "blocked"}`}>
            {capabilities.liveResearchReady
              ? `OpenAI + ${liveSource} + webhook real · ${activeCount} ${activeCount === 1 ? "lead" : "leads"} · costo est. < USD ${estCost}`
              : "Prueba real deshabilitada: requiere OpenAI + public info live + webhook live"}
          </span>
          <button type="button" className="button" disabled={liveDisabled} onClick={createLive}>
            {creating === "live" ? "Investigando…" : `Ejecutar prueba real · ${activeCount} ${activeCount === 1 ? "empresa" : "empresas"}`}
          </button>
        </div>
        {error && <div className="toast">{error}</div>}
      </div>
    </div>
  );
}
