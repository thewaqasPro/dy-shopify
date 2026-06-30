import { notFound } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/lib/ui/app-shell";
import { StatusBadge } from "@/lib/ui/badge";
import { Pagination } from "@/lib/ui/pagination";
import { ProductImage } from "@/lib/ui/product-image";

export const dynamic = "force-dynamic";

const EVENT_PAGE_SIZE = 25;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ eventsPage?: string }>;

export default async function ProductDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const eventsPage = Math.max(Number(query.eventsPage ?? "1"), 1);

  const product = await prisma.productRecord.findUnique({
    where: { id },
    include: {
      media: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!product) notFound();

  const [events, eventTotal] = await Promise.all([
    prisma.syncEvent.findMany({
      where: { productRecordId: product.id },
      orderBy: { createdAt: "desc" },
      skip: (eventsPage - 1) * EVENT_PAGE_SIZE,
      take: EVENT_PAGE_SIZE,
      include: { syncRun: true }
    }),
    prisma.syncEvent.count({ where: { productRecordId: product.id } })
  ]);

  const heroImage = product.imageUrl ?? product.media[0]?.sourceUrl ?? null;
  const shopifyAdminUrl = buildShopifyAdminProductUrl(product.shopifyProductId);

  return (
    <AppShell>
      <div className="page-heading detail-heading">
        <div className="breadcrumb"><Link href="/products">Products</Link><span>/</span><span>{product.bossId}</span></div>
        <div className="product-hero">
          <ProductImage src={heroImage} alt={product.title} size="lg" />
          <div>
            <span className="eyebrow">Product detail</span>
            <h1>{product.title}</h1>
            <div className="actions">
              <StatusBadge value={product.inStock ? "IN STOCK" : "OUT OF STOCK"} />
              <StatusBadge value={product.syncStatus} />
              {product.shopifyStatus ? <StatusBadge value={product.shopifyStatus} /> : null}
            </div>
          </div>
        </div>
      </div>

      <section className="grid cols-4" style={{ marginBottom: 16 }}>
        <Metric label="Price USD" value={product.priceUsd ? `$${product.priceUsd.toString()}` : "—"} />
        <Metric label="SKU" value={product.sku ?? "—"} />
        <Metric label="UPC / Barcode" value={product.upc ?? "—"} />
        <Metric label="Media records" value={product.media.length.toLocaleString()} />
      </section>

      <section className="grid detail-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Product identity</h2>
          <KeyValue label="Boss Logics ID" value={product.bossId} />
          <KeyValue label="Vendor" value={product.vendor} />
          <KeyValue label="Type" value={product.productType ?? "—"} />
          <KeyValue label="Shopify product ID" value={product.shopifyProductId ?? "—"} />
          <KeyValue label="Shopify handle" value={product.shopifyHandle ?? "—"} />
          <KeyValue label="Shopify admin" value={shopifyAdminUrl ? <a href={shopifyAdminUrl} target="_blank" rel="noreferrer">Open in Shopify</a> : "—"} />
        </div>

        <div className="card">
          <h2>Sync state</h2>
          <KeyValue label="Stock raw" value={product.stockRaw ?? "—"} />
          <KeyValue label="Last seen" value={product.lastSeenAt ? `${format(product.lastSeenAt, "PPpp")} (${formatDistanceToNow(product.lastSeenAt, { addSuffix: true })})` : "—"} />
          <KeyValue label="Last synced" value={product.lastSyncedAt ? `${format(product.lastSyncedAt, "PPpp")} (${formatDistanceToNow(product.lastSyncedAt, { addSuffix: true })})` : "—"} />
          <KeyValue label="Missing since" value={product.missingSince ? format(product.missingSince, "PPpp") : "—"} />
          <KeyValue label="Last error" value={product.lastError ? <span className="error">{product.lastError}</span> : "—"} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Image gallery</h2>
        {product.media.length ? (
          <div className="image-grid">
            {product.media.map((media) => (
              <a className="image-card" key={media.id} href={media.sourceUrl} target="_blank" rel="noreferrer">
                <ProductImage src={media.sourceUrl} alt={product.title} size="md" />
                <span className="helper">{media.status}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="helper">No media records stored yet. Run a dry-run/live sync after the Boss Logics image fields are populated.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Tags</h2>
        <div className="tag-list">
          {product.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          {!product.tags.length ? <span className="helper">No tags stored.</span> : null}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="table-card-header">
          <div>
            <h2>Product events</h2>
            <p className="helper">Every sync event tied to this product.</p>
          </div>
          <Pagination basePath={`/products/${product.id}`} page={eventsPage} pageSize={EVENT_PAGE_SIZE} total={eventTotal} pageParam="eventsPage" />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Level</th><th>Run</th><th>Type</th><th>Message</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{format(event.createdAt, "PPpp")}</td>
                  <td><StatusBadge value={event.level} /></td>
                  <td><Link href={`/runs/${event.syncRunId}`}>{event.syncRunId.slice(0, 8)}</Link></td>
                  <td>{event.eventType}</td>
                  <td>{event.message}</td>
                </tr>
              ))}
              {!events.length ? <tr><td colSpan={5}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Raw Boss Logics data</h2>
        <p className="helper">This is the exact normalized Boss Logics record stored during the latest sync, preserved for future comparisons/debugging.</p>
        <pre>{JSON.stringify(product.raw, null, 2)}</pre>
      </section>
    </AppShell>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span className="helper">{label}</span><span>{value}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value small">{value}</div></div>;
}

function buildShopifyAdminProductUrl(shopifyProductId?: string | null) {
  if (!shopifyProductId) return null;
  const numericId = shopifyProductId.split("/").pop();
  if (!numericId) return null;
  const shop = getEnv().SHOPIFY_SHOP.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${shop}/products/${numericId}`;
}
