"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryButton({ batchId }: { batchId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function retry() {
    setLoading(true);
    await fetch(`/api/growth/batches/${batchId}/retry-failed`, { method: "POST" });
    router.refresh(); setLoading(false);
  }
  return <button className="button buttonSecondary" disabled={loading} onClick={retry}>{loading ? "Reintentando…" : "Reintentar fallidos"}</button>;
}
