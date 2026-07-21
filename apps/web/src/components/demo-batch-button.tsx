"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoBatchButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function createDemo() {
    setLoading(true); setError("");
    try {
      const fixture = await fetch("/demo-batch.json").then((response) => response.json());
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/batches`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fixture),
      });
      if (!response.ok) throw new Error(`La API respondió ${response.status}`);
      const batch = await response.json();
      router.push(`/batches/${batch.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el batch");
      setLoading(false);
    }
  }

  return <div><button className="button" disabled={loading} onClick={createDemo}>{loading ? "Creando…" : "Ejecutar batch demo"}</button>{error && <div className="toast">{error}</div>}</div>;
}
