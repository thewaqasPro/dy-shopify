import "dotenv/config";

import { Worker } from "bullmq";
import IORedis from "ioredis";
import cron from "node-cron";
import pino from "pino";
import { getEnv } from "@/lib/env";
import { enqueueSyncRun, type SyncJobName, type SyncJobPayload, type SyncJobResult } from "@/lib/sync/queue";
import { executeSyncRun } from "@/lib/sync/runner";

const logger = pino({
  transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined
});

const env = getEnv();
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<SyncJobPayload, SyncJobResult, SyncJobName>(
  env.SYNC_QUEUE_NAME,
  async (job) => {
    logger.info({ runId: job.data.runId }, "Starting sync job");
    await executeSyncRun(job.data.runId);
    logger.info({ runId: job.data.runId }, "Sync job completed");
  },
  {
    connection,
    concurrency: env.SYNC_CONCURRENCY,
    lockDuration: 1000 * 60 * 30
  }
);

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "Sync job failed");
});

worker.on("error", (error) => {
  logger.error({ error }, "Worker error");
});

if (env.SYNC_CRON_ENABLED) {
  cron.schedule(env.SYNC_CRON, async () => {
    try {
      const run = await enqueueSyncRun({ dryRun: env.SYNC_DEFAULT_DRY_RUN, triggeredBy: "cron", archiveMissing: true });
      logger.info({ runId: run.id }, "Cron sync enqueued");
    } catch (error) {
      logger.error({ error }, "Failed to enqueue cron sync");
    }
  });
  logger.info({ cron: env.SYNC_CRON }, "Cron scheduler enabled");
}

const shutdown = async () => {
  logger.info("Shutting down worker");
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
