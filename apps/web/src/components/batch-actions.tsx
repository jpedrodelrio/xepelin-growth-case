"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProviderCapabilities } from "@/lib/api";

// Defaults reutilizados del fixture de prueba real (owner/webhook demo).
const LIVE_DEFAULTS = {
  segment: "pyme_servicios",
  owner_email: "growth.synthetic@xepelin.com",
  webhook_url: "https://webhook.site/demo-xepelin-growth",
};

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
  const [legalName, setLegalName] = useState("");
  const [website, setWebsite] = useState("");
  const [legalId, setLegalId] = useState("");
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

  async function createLive() {
    if (!legalName.trim() || !isHttpUrl(website.trim())) {
      setError("Ingresa una razón social y un sitio web válido (http/https).");
      return;
    }
    setCreating("live");
    setError("");
    try {
      const payload = {
        name: `Prueba real · ${legalName.trim()}`,
        segment: LIVE_DEFAULTS.segment,
        owner_email: LIVE_DEFAULTS.owner_email,
        webhook_url: LIVE_DEFAULTS.webhook_url,
        leads: [
          {
            // El RUT es opcional para el research en vivo; placeholder si no se ingresa.
            legal_id: legalId.trim() || "99.999.999-9",
            legal_name: legalName.trim(),
            website: website.trim(),
          },
        ],
      };
      await postBatch(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el batch");
      setCreating(null);
    }
  }

  const liveSource = capabilities.publicInfo.source === "brave" ? "Brave Search" : "Wikipedia";
  const liveDisabled = creating !== null || !capabilities.liveResearchReady;
  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border, #d0d5dd)",
    background: "var(--surface, #fff)",
    color: "inherit",
    fontSize: 14,
    minWidth: 220,
  };

  return (
    <div className="batchActions">
      <div className="batchActionButtons">
        <button className="button buttonSecondary" disabled={creating !== null} onClick={createDemo}>
          {creating === "demo" ? "Creando…" : "Ejecutar demo"}
        </button>
      </div>

      {/* Prueba real: el usuario ingresa la empresa a investigar (no un fixture fijo). */}
      <div className="liveResearchForm" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
        <input
          style={inputStyle}
          placeholder="Razón social (ej. Rhona S.A.)"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          disabled={liveDisabled}
        />
        <input
          style={inputStyle}
          placeholder="Sitio web (https://…)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          disabled={liveDisabled}
        />
        <input
          style={{ ...inputStyle, minWidth: 150 }}
          placeholder="RUT (opcional)"
          value={legalId}
          onChange={(e) => setLegalId(e.target.value)}
          disabled={liveDisabled}
        />
        <button className="button" disabled={liveDisabled} onClick={createLive}>
          {creating === "live" ? "Investigando…" : "Ejecutar prueba real"}
        </button>
      </div>

      <div className={`providerReadiness ${capabilities.liveResearchReady ? "ready" : "blocked"}`}>
        {capabilities.liveResearchReady
          ? `OpenAI + ${liveSource} · 1 lead · costo estimado menor a USD 0,01`
          : "Prueba real deshabilitada: requiere OpenAI + public info live + webhook demo"}
      </div>
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
