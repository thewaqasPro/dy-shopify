import { LogLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EventInput = {
  runId: string;
  productRecordId?: string | null;
  level?: LogLevel;
  eventType: string;
  message: string;
  data?: Prisma.InputJsonValue;
};

export async function logSyncEvent(input: EventInput) {
  return prisma.syncEvent.create({
    data: {
      syncRunId: input.runId,
      productRecordId: input.productRecordId ?? null,
      level: input.level ?? "INFO",
      eventType: input.eventType,
      message: input.message,
      data: input.data ?? Prisma.JsonNull
    }
  });
}
