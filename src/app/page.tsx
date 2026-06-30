import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/lib/ui/app-shell";
import { StatusBadge } from "@/lib/ui/badge";
import { Pagination } from "@/lib/ui/pagination";
import { ProductImage } from "@/lib/ui/product-image";
import { enqueueDryRunAction, enqueueLiveRunAction } from "./actions";

export const dynamic = "force-dynamic";

const EVENTS_PAGE_SIZE = 8;

type SearchParams = Promise<{ eventsPage?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const eventsPage = Math.max(Number(params.eventsPage ?? "1"), 1);

  const [latestRun, counts, recentProducts, recentEvents, eventTotal] = await Promise.all([
    prisma.syncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.$transaction([
      prisma.productRecord.count({ where: { inStock: true } }),
      prisma.productRecord.count({ where: { inStock: true, syncStatus: "SYNCED" } }),
      prisma.productRecord.count({ where: { inStock: true, syncStatus: "FAILED" } }),
      prisma.productRecord.count({ where: { syncStatus: "MISSING", inStock: true } }),
      prisma.productRecord.count({ where: { syncStatus: "ARCHIVED" } }),
      prisma.productMedia.count()
    ]),
    prisma.productRecord.findMany({
      where: { inStock: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { media: { orderBy: { createdAt: "asc" }, take: 1 } }
    }),
    prisma.syncEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip: (eventsPage - 1) * EVENTS_PAGE_SIZE,
      take: EVENTS_PAGE_SIZE,
      include: { productRecord: true }
    }),
    prisma.syncEvent.count()
  ]);

  return (
    <AppShell>
      <div className="hero-panel">
        <div>
          <span className="eyebrow">David Yurman Shopify sync</span>
          <h1>Inventory dashboard</h1>
          <p>Only in-stock Boss Logics products are eligible for Shopify sync and shown in the default product views.</p>
        </div>
        <div className="actions">
          <form action={enqueueDryRunAction}><button className="btn" type="submit">Run dry-run</button></form>
          <form action={enqueueLiveRunAction}><button className="btn primary" type="submit">Run live sync</button></form>
        </div>
      </div>

      <section className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="In-stock products" value={counts[0]} />
        <Metric label="Synced in-stock" value={counts[1]} />
        <Metric label="Needs attention" value={counts[2] + counts[3]} tone="danger" />
        <Metric label="Stored images" value={counts[5]} />
      </section>

      <section className="grid dashboard-grid" style={{ marginBottom: 16 }}>
        <div className="card latest-card">
          <h2>Latest run</h2>
          {latestRun ? (
            <div className="grid">
              <div className="kv"><span className="helper">Status</span><StatusBadge value={latestRun.status} /></div>
              <div className="kv"><span className="helper">Mode</span><StatusBadge value={latestRun.mode} /></div>
              <div className="kv"><span className="helper">Created</span><span>{formatDistanceToNow(latestRun.createdAt, { addSuffix: true })}</span></div>
              <div className="kv"><span className="helper">Raw / in-stock eligible</span><span>{latestRun.totalRaw} / {latestRun.totalEligible}</span></div>
              <div className="kv"><span className="helper">Ignored out-of-stock</span><span>{latestRun.outOfStockCount}</span></div>
              <div className="kv"><span className="helper">Created / updated</span><span>{latestRun.createdCount} / {latestRun.updatedCount}</span></div>
              <div className="kv"><span className="helper">Archived / failed</span><span>{latestRun.archivedCount} / {latestRun.failedCount}</span></div>
            </div>
          ) : <p className="helper">No sync run yet. Start with a dry-run.</p>}
        </div>

        <div className="card">
          <div className="table-card-header">
            <div>
              <h2>Recently updated in-stock products</h2>
              <p className="helper">Quick access to product detail pages and raw Boss Logics data.</p>
            </div>
            <Link className="btn ghost" href="/products">View all</Link>
          </div>
          <div className="product-list">
            {recentProducts.map((product) => (
              <Link className="product-row" href={`/products/${product.id}`} key={product.id}>
                <ProductImage src={product.imageUrl ?? product.media[0]?.sourceUrl ?? null} alt={product.title} size="sm" />
                <span>
                  <strong>{product.title}</strong>
                  <span className="helper">{product.sku ?? "No SKU"} · {product.upc ?? "No UPC"}</span>
                </span>
                <StatusBadge value={product.syncStatus} />
              </Link>
            ))}
            {!recentProducts.length ? <p className="helper">No in-stock products stored yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="card table-card">
        <div className="table-card-header">
          <div>
            <h2>Recent events</h2>
            <p className="helper">Paginated audit trail across all sync runs.</p>
          </div>
          <Pagination basePath="/" page={eventsPage} pageSize={EVENTS_PAGE_SIZE} total={eventTotal} pageParam="eventsPage" />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Level</th><th>Event</th><th>Product</th><th>Message</th></tr></thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDistanceToNow(event.createdAt, { addSuffix: true })}</td>
                  <td><StatusBadge value={event.level} /></td>
                  <td>{event.eventType}</td>
                  <td>{event.productRecord ? <Link href={`/products/${event.productRecord.id}`}>{event.productRecord.title}</Link> : "—"}</td>
                  <td>{event.message}</td>
                </tr>
              ))}
              {!recentEvents.length ? <tr><td colSpan={5}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return <div className={`metric-card ${tone === "danger" ? "metric-danger" : ""}`}><div className="metric-label">{label}</div><div className="metric-value">{value.toLocaleString()}</div></div>;
}
