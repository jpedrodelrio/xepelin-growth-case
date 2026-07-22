import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { CreateBatch, GetBatchDetail, ListBatches, RetryFailedLeads } from "@xepelin/core";
import { z } from "zod";
import { TOKENS } from "./tokens.js";

const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  segment: z.string().trim().min(1).max(80),
  owner_email: z.string().email(),
  webhook_url: z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "webhook_url must use HTTP or HTTPS",
  }),
  leads: z.array(z.object({
    legal_id: z.string(),
    legal_name: z.string().trim().min(1),
    website: z.string(),
  })).min(1).max(10_000),
});

@Controller("batches")
export class BatchesController {
  constructor(
    @Inject(TOKENS.createBatch) private readonly createBatch: CreateBatch,
    @Inject(TOKENS.listBatches) private readonly listBatches: ListBatches,
    @Inject(TOKENS.getBatchDetail) private readonly getBatchDetail: GetBatchDetail,
    @Inject(TOKENS.retryFailedLeads) private readonly retryFailed: RetryFailedLeads,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    return this.createBatch.execute({
      name: input.name,
      segment: input.segment,
      ownerEmail: input.owner_email,
      webhookUrl: input.webhook_url,
      leads: input.leads.map((lead) => ({
        legalId: lead.legal_id,
        legalName: lead.legal_name,
        website: lead.website,
      })),
    });
  }

  @Get()
  list() {
    return this.listBatches.execute();
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const batch = await this.getBatchDetail.execute(id);
    if (!batch) throw new NotFoundException("Batch not found");
    return batch;
  }

  @Post(":id/retry-failed")
  async retry(@Param("id") id: string) {
    try {
      return await this.retryFailed.execute(id);
    } catch (error) {
      if (error instanceof Error && error.message === "Batch not found") throw new NotFoundException(error.message);
      throw error;
    }
  }
}
