export const TOKENS = {
  createBatch: Symbol("CreateBatch"),
  listBatches: Symbol("ListBatches"),
  getBatchDetail: Symbol("GetBatchDetail"),
  retryFailedLeads: Symbol("RetryFailedLeads"),
} as const;
