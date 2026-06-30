import { assertAdminForApi, getSession } from "@/lib/auth/session";
import { enqueueSyncRun } from "@/lib/sync/queue";

export async function POST(request: Request) {
  const unauthorized = await assertAdminForApi();
  if (unauthorized) return unauthorized;

  const session = await getSession();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const dryRun = body.dryRun !== false;
  const archiveMissing = body.archiveMissing !== false;
  const maxProducts = typeof body.maxProducts === "number" ? body.maxProducts : undefined;

  const run = await enqueueSyncRun({ dryRun, archiveMissing, maxProducts, triggeredBy: session?.email ?? "api" });
  return Response.json({ runId: run.id, status: run.status, mode: run.mode });
}
