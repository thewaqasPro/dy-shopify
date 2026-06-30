import { Queue } from "bullmq";
import IORedis from "ioredis";
import { SyncRunMode } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const SYNC_JOB_NAME = "sync-bosslogics-to-shopify" as const;

export type SyncJobName = typeof SYNC_JOB_NAME;
export type SyncJobPayload = {
  runId: string;
};
export type SyncJobResult = void;

let connection: IORedis | undefined;
let queue: ReturnType<typeof createSyncQueue> | undefined;

function getConnection() {
  if (!connection) {
    connection = new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

function createSyncQueue() {
  return new Queue<SyncJobPayload, SyncJobResult, SyncJobName>(getEnv().SYNC_QUEUE_NAME, {
    connection: getConnection()
  });
}

export function getSyncQueue() {
  if (!queue) {
    queue = createSyncQueue();
  }
  return queue;
}

export async function enqueueSyncRun(input: { dryRun: boolean; triggeredBy?: string; archiveMissing?: boolean; maxProducts?: number }) {
  const run = await prisma.syncRun.create({
    data: {
      mode: input.dryRun ? SyncRunMode.DRY_RUN : SyncRunMode.APPLY,
      triggeredBy: input.triggeredBy ?? "manual",
      options: {
        dryRun: input.dryRun,
        archiveMissing: input.archiveMissing ?? true,
        maxProducts: input.maxProducts ?? getEnv().SYNC_MAX_PRODUCTS_PER_RUN
      }
    }
  });

  await getSyncQueue().add(
    SYNC_JOB_NAME,
    { runId: run.id },
    {
      jobId: run.id,
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );

  return run;
}
