import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { JobQueue } from "@xepelin/core";

export const BATCH_QUEUE = "batch-processing";

export function createRedisConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export class BullMqJobQueue implements JobQueue {
  private readonly queue = new Queue(BATCH_QUEUE, { connection: createRedisConnection() });

  async enqueueBatch(batchId: string): Promise<void> {
    await this.queue.add("process-batch", { batchId }, {
      // BullMQ reserves ':' inside custom job ids.
      jobId: `${batchId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
