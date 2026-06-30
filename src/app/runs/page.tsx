import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/lib/ui/app-shell";
import { StatusBadge } from "@/lib/ui/badge";
import { Pagination } from "@/lib/ui/pagination";
import { enqueueDryRunAction, enqueueLiveRunAction } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Promise<{ page?: string }>;

export default async function RunsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(Number(params.page ?? "1"), 1);
  const [runs, total] = await Promise.all([
    prisma.syncRun.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.syncRun.count()
  ]);

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Audit</span>
          <h1>Sync runs</h1>
          <p>Every sync has its own counters, logs, and product-level events.</p>
        </div>
        <div className="actions">
          <form action={enqueueDryRunAction}><button className="btn" type="submit">Run dry-run</button></form>
          <form action={enqueueLiveRunAction}><button className="btn primary" type="submit">Run live sync</button></form>
        </div>
      </div>

      <section className="card table-card">
        <div className="table-card-header">
          <div>
            <h2>Run history</h2>
            <p className="helper">Latest runs first.</p>
          </div>
          <Pagination basePath="/runs" page={page} pageSize={PAGE_SIZE} total={total} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Run</th><th>Status</th><th>Mode</th><th>Triggered by</th><th>Raw / in-stock</th><th>Created / updated</th><th>OOS ignored</th><th>Missing / archived</th><th>Failed</th></tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td><Link href={`/runs/${run.id}`}><strong>{run.id.slice(0, 8)}</strong></Link><br /><span className="helper">{formatDistanceToNow(run.createdAt, { addSuffix: true })}</span></td>
                  <td><StatusBadge value={run.status} /></td>
                  <td><StatusBadge value={run.mode} /></td>
                  <td>{run.triggeredBy}</td>
                  <td>{run.totalRaw} / {run.totalEligible}</td>
                  <td>{run.createdCount} / {run.updatedCount}</td>
                  <td>{run.outOfStockCount}</td>
                  <td>{run.missingCount} / {run.archivedCount}</td>
                  <td>{run.failedCount}</td>
                </tr>
              ))}
              {!runs.length ? <tr><td colSpan={9}>No sync runs yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/runs" page={page} pageSize={PAGE_SIZE} total={total} />
      </section>
    </AppShell>
  );
}
