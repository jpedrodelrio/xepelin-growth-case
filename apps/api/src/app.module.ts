import { Module } from "@nestjs/common";
import { CreateBatch, GetBatchDetail, ListBatches, RetryFailedLeads } from "@xepelin/core";
import { BullMqJobQueue, PrismaRepositories } from "@xepelin/infrastructure";
import { BatchesController } from "./batches.controller.js";
import { TOKENS } from "./tokens.js";

const repositories = new PrismaRepositories();
const queue = new BullMqJobQueue();

@Module({
  controllers: [BatchesController],
  providers: [
    { provide: TOKENS.createBatch, useValue: new CreateBatch(repositories, queue) },
    { provide: TOKENS.listBatches, useValue: new ListBatches(repositories) },
    { provide: TOKENS.getBatchDetail, useValue: new GetBatchDetail(repositories) },
    { provide: TOKENS.retryFailedLeads, useValue: new RetryFailedLeads(repositories, repositories, queue) },
  ],
})
export class AppModule {}
