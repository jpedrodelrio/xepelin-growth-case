import type { BatchDetail } from "@/lib/api";

const terminalLeadStatuses = new Set(["ready", "failed", "ai_ready", "ai_failed"]);

export interface BatchTimingMetrics {
  batchDurationMs: number | null;
  averageLeadDurationMs: number | null;
  minLeadDurationMs: number | null;
  maxLeadDurationMs: number | null;
  leadDurationById: Record<string, number | null>;
}

function toTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function durationBetween(start: number | null, end: number | null): number | null {
  if (start === null || end === null || end < start) return null;
  return end - start;
}

function eventTimestamp(
  events: BatchDetail["events"],
  predicate: (event: BatchDetail["events"][number]) => boolean,
  select: "earliest" | "latest",
): number | null {
  const timestamps = events
    .filter(predicate)
    .map((event) => toTimestamp(event.createdAt))
    .filter((timestamp): timestamp is number => timestamp !== null);

  if (timestamps.length === 0) return null;
  return select === "earliest" ? Math.min(...timestamps) : Math.max(...timestamps);
}

export function calculateBatchTimings(batch: BatchDetail): BatchTimingMetrics {
  const batchStartedAt = eventTimestamp(
    batch.events,
    (event) => event.type === "batch_status_changed" && event.toStatus === "processing",
    "earliest",
  ) ?? toTimestamp(batch.createdAt);
  const batchCompletedAt = eventTimestamp(
    batch.events,
    (event) => event.type === "batch_status_changed" && event.toStatus === "completed",
    "latest",
  ) ?? (batch.status === "completed" ? toTimestamp(batch.updatedAt) : null);

  const leadDurationById: Record<string, number | null> = {};
  const completedLeadDurations: number[] = [];

  for (const lead of batch.leads) {
    const leadStartedAt = eventTimestamp(
      batch.events,
      (event) => event.leadId === lead.id && event.type === "lead_status_changed" && event.toStatus === "processing",
      "earliest",
    ) ?? toTimestamp(lead.createdAt);
    const leadCompletedAt = eventTimestamp(
      batch.events,
      (event) => event.leadId === lead.id && event.type === "lead_status_changed" && terminalLeadStatuses.has(event.toStatus ?? ""),
      "latest",
    ) ?? (terminalLeadStatuses.has(lead.status) ? toTimestamp(lead.updatedAt) : null);
    const durationMs = durationBetween(leadStartedAt, leadCompletedAt);

    leadDurationById[lead.id] = durationMs;
    if (durationMs !== null) completedLeadDurations.push(durationMs);
  }

  const totalLeadDuration = completedLeadDurations.reduce((total, duration) => total + duration, 0);

  return {
    batchDurationMs: durationBetween(batchStartedAt, batchCompletedAt),
    averageLeadDurationMs: completedLeadDurations.length > 0 ? totalLeadDuration / completedLeadDurations.length : null,
    minLeadDurationMs: completedLeadDurations.length > 0 ? Math.min(...completedLeadDurations) : null,
    maxLeadDurationMs: completedLeadDurations.length > 0 ? Math.max(...completedLeadDurations) : null,
    leadDurationById,
  };
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "—";
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;

  const seconds = durationMs / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes} min ${remainingSeconds} s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h ${remainingMinutes} min`;
}
