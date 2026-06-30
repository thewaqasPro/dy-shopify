"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { enqueueSyncRun } from "@/lib/sync/queue";

export async function enqueueDryRunAction() {
  const session = await requireAdmin();
  await enqueueSyncRun({ dryRun: true, triggeredBy: session.email, archiveMissing: false });
  revalidatePath("/");
  revalidatePath("/runs");
}

export async function enqueueLiveRunAction() {
  const session = await requireAdmin();
  await enqueueSyncRun({ dryRun: false, triggeredBy: session.email, archiveMissing: true });
  revalidatePath("/");
  revalidatePath("/runs");
}
