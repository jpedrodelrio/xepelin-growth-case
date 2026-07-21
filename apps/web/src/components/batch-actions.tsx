"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProviderCapabilities } from "@/lib/api";

export function BatchActions({ capabilities }: { capabilities: ProviderCapabilities }) {
  const [creating, setCreating] = useState<"demo" | "live" | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function createBatch(mode: "demo" | "live") {
    setCreating(mode);
    setError("");
    try {
      const fixturePath = mode === "live" ? "/live-research-batch.json" : "/demo-batch.json";
      const fixtureResponse = await fetch(fixturePath);
      if (!fixtureResponse.ok) throw new Error("No fue posible cargar el fixture");
      const fixture = await fixtureResponse.json();
      const response = await fetch("/api/growth/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixture),
      });
      if (!response.ok) throw new Error(`La API respondió ${response.status}`);
      const batch = await response.json() as { id: string };
      router.push(`/batches/${batch.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el batch");
      setCreating(null);
    }
  }

  const liveSource = capabilities.publicInfo.source === "brave" ? "Brave Search" : "Wikipedia";
  return (
    <div className="batchActions">
      <div className="batchActionButtons">
        <button className="button buttonSecondary" disabled={creating !== null} onClick={() => createBatch("demo")}>
          {creating === "demo" ? "Creando…" : "Ejecutar demo"}
        </button>
        <button className="button" disabled={creating !== null || !capabilities.liveResearchReady} onClick={() => createBatch("live")}>
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
