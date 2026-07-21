import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { CompleteBatch, ProcessLead } from "@xepelin/core";
import {
  BATCH_QUEUE,
  HttpWebsiteAvailabilityChecker,
  PrismaRepositories,
  createAiProvider,
  createPublicInfoProvider,
  createRedisConnection,
  createWebhookSender,
} from "@xepelin/infrastructure";
import { Worker } from "bullmq";

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private readonly repositories = new PrismaRepositories();
  private worker?: Worker<{ batchId: string }>;

  onModuleInit(): void {
    const processLead = new ProcessLead(
      this.repositories,
      new HttpWebsiteAvailabilityChecker(),
      createPublicInfoProvider(),
      createAiProvider(),
    );
    const completeBatch = new CompleteBatch(
      this.repositories,
      this.repositories,
      createWebhookSender(),
      process.env.WEB_URL ?? "http://localhost:3000",
    );

    this.worker = new Worker<{ batchId: string }>(
      BATCH_QUEUE,
      async (job) => {
        const { batchId } = job.data;
        this.logger.log({ event: "batch_started", batchId, jobId: job.id });
        await this.repositories.setStatus(batchId, "processing");
        const pending = (await this.repositories.listByBatch(batchId)).filter((lead) => lead.status === "pending");

        let cursor = 0;
        const runners = Array.from({ length: Math.min(5, pending.length) }, async () => {
          while (cursor < pending.length) {
            const lead = pending[cursor++];
            if (lead) await processLead.execute(lead.id);
          }
        });
        await Promise.all(runners);
        await completeBatch.execute(batchId);
        this.logger.log({ event: "batch_completed", batchId, jobId: job.id });
      },
      { connection: createRedisConnection(), concurrency: 2 },
    );

    this.worker.on("failed", async (job, error) => {
      this.logger.error({ event: "batch_job_failed", batchId: job?.data.batchId, jobId: job?.id, error: error.message });
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        await this.repositories.setStatus(job.data.batchId, "failed");
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
