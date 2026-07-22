"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const refreshIntervalMs = 1_500;

export function LiveBatchRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, refreshIntervalMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [active, router]);

  return (
    <div className={`liveRefresh ${active ? "active" : "complete"}`} aria-live="polite">
      <span className="liveRefreshDot" aria-hidden="true" />
      {active ? "Actualizando en vivo · cada 1,5 s" : "Estado sincronizado"}
    </div>
  );
}
