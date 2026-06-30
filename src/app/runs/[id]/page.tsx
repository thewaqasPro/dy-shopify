import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/lib/ui/app-shell";
import { StatusBadge } from "@/lib/ui/badge";
import { Pagination } from "@/lib/ui/pagination";

const EVENT_PAGE_SIZE = 50;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ eventsPage?: string }>;

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const eventsPage = Math.max(Number(query.eventsPage ?? "1"), 1);

  const run = await prisma.syncRun.findUnique({ where: { id } });
  if (!run) notFound();

  const [events, eventTotal] = await Promise.all([
    prisma.syncEvent.findMany({
      where: { syncRunId: run.id },
      orderBy: { createdAt: "desc" },
      skip: (eventsPage - 1) * EVENT_PAGE_SIZE,
      take: EVENT_PAGE_SIZE,
      include: { productRecord: true }
    }),
    prisma.syncEvent.count({ where: { syncRunId: run.id } })
  ]);

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Sync run</span>
          <h1>Run {run.id.slice(0, 8)}</h1>
          <p>{format(run.createdAt, "PPpp")}</p>
        </div>
        <div className="actions"><StatusBadge value={run.status} /><StatusBadge value={run.mode} /></div>
      </div>

      <section className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="Raw" value={run.totalRaw} />
        <Metric label="In-stock eligible" value={run.totalEligible} />
        <Metric label="Ignored out of stock" value={run.outOfStockCount} />
        <Metric label="Created" value={run.createdCount} />
        <Metric label="Updated" value={run.updatedCount} />
        <Metric label="Missing" value={run.missingCount} />
        <Metric label="Archived" value={run.archivedCount} />
        <Metric label="Failed" value={run.failedCount} />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Run metadata</h2>
        <div className="kv"><span className="helper">Started</span><span>{run.startedAt ? format(run.startedAt, "PPpp") : "—"}</span></div>
        <div className="kv"><span className="helper">Finished</span><span>{run.finishedAt ? format(run.finishedAt, "PPpp") : "—"}</span></div>
        <div className="kv"><span className="helper">Triggered by</span><span>{run.triggeredBy}</span></div>
        <div className="kv"><span className="helper">Message</span><span>{run.message ?? "—"}</span></div>
        <div className="kv"><span className="helper">Options</span><pre>{JSON.stringify(run.options, null, 2)}</pre></div>
      </section>

      <section className="card table-card">
        <div className="table-card-header">
          <div>
            <h2>Events</h2>
            <p className="helper">Paginated event log for this run.</p>
          </div>
          <Pagination basePath={`/runs/${run.id}`} page={eventsPage} pageSize={EVENT_PAGE_SIZE} total={eventTotal} pageParam="eventsPage" />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Level</th><th>Type</th><th>Product</th><th>Message</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{format(event.createdAt, "PPpp")}</td>
                  <td><StatusBadge value={event.level} /></td>
                  <td>{event.eventType}</td>
                  <td>{event.productRecord ? <Link href={`/products/${event.productRecord.id}`}>{event.productRecord.title}</Link> : "—"}</td>
                  <td>{event.message}</td>
                </tr>
              ))}
              {!events.length ? <tr><td colSpan={5}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination basePath={`/runs/${run.id}`} page={eventsPage} pageSize={EVENT_PAGE_SIZE} total={eventTotal} pageParam="eventsPage" />
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value.toLocaleString()}</div></div>;
}
