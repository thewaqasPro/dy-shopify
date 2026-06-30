import { Prisma, ProductSyncStatus } from "@prisma/client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/lib/ui/app-shell";
import { StatusBadge } from "@/lib/ui/badge";
import { Pagination } from "@/lib/ui/pagination";
import { ProductImage } from "@/lib/ui/product-image";
import { truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Promise<{ q?: string; status?: string; stock?: string; page?: string }>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(Number(params.page ?? "1"), 1);
  const stock = params.stock === "all" || params.stock === "out" ? params.stock : "in";
  const status = Object.values(ProductSyncStatus).includes(params.status as ProductSyncStatus)
    ? (params.status as ProductSyncStatus)
    : undefined;

  const where: Prisma.ProductRecordWhereInput = {
    ...(stock === "in" ? { inStock: true } : {}),
    ...(stock === "out" ? { inStock: false } : {}),
    ...(status ? { syncStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { upc: { contains: q, mode: "insensitive" } },
            { bossId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [products, total, inStockCount, failedInStockCount] = await Promise.all([
    prisma.productRecord.findMany({
      where,
      orderBy: [{ inStock: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { media: { orderBy: { createdAt: "asc" }, take: 1 } }
    }),
    prisma.productRecord.count({ where }),
    prisma.productRecord.count({ where: { inStock: true } }),
    prisma.productRecord.count({ where: { inStock: true, syncStatus: ProductSyncStatus.FAILED } })
  ]);

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Catalog</span>
          <h1>Products</h1>
          <p>Default view shows only in-stock David Yurman products from Boss Logics.</p>
        </div>
      </div>

      <section className="grid cols-3" style={{ marginBottom: 16 }}>
        <Metric label="Visible in-stock products" value={inStockCount} />
        <Metric label="Current filtered result" value={total} />
        <Metric label="In-stock failures" value={failedInStockCount} tone="danger" />
      </section>

      <section className="card filter-card" style={{ marginBottom: 16 }}>
        <form className="actions">
          <input
            className="input search-input"
            name="q"
            placeholder="Search title, SKU, UPC, Boss ID"
            defaultValue={q}
          />
          <select className="input select-input" name="stock" defaultValue={stock}>
            <option value="in">In stock only</option>
            <option value="out">Out of stock only</option>
            <option value="all">All local records</option>
          </select>
          <select className="input select-input" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {Object.values(ProductSyncStatus).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button className="btn" type="submit">Filter</button>
          <Link className="btn ghost" href="/products">Reset</Link>
        </form>
      </section>

      <section className="card table-card">
        <div className="table-card-header">
          <div>
            <h2>Inventory</h2>
            <p className="helper">Images are stored as Boss Logics source URLs and synced to Shopify media during live sync.</p>
          </div>
          <Pagination
            basePath="/products"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            params={{ q, status, stock }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU / UPC</th>
                <th>Status</th>
                <th>Shopify</th>
                <th>Stock</th>
                <th>Last seen</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const image = product.imageUrl ?? product.media[0]?.sourceUrl ?? null;
                return (
                  <tr key={product.id}>
                    <td>
                      <Link className="product-cell" href={`/products/${product.id}`}>
                        <ProductImage src={image} alt={product.title} size="sm" />
                        <span>
                          <strong>{product.title}</strong>
                          <br />
                          <span className="helper">Boss ID: {product.bossId}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {product.sku ?? "—"}
                      <br />
                      <span className="helper">{product.upc ?? "—"}</span>
                    </td>
                    <td><StatusBadge value={product.syncStatus} /></td>
                    <td>
                      {product.shopifyHandle ? product.shopifyHandle : "—"}
                      <br />
                      <span className="helper">{product.shopifyStatus ?? "No status"}</span>
                    </td>
                    <td>{product.inStock ? <StatusBadge value="IN STOCK" /> : <StatusBadge value="OUT OF STOCK" />}</td>
                    <td>{product.lastSeenAt ? formatDistanceToNow(product.lastSeenAt, { addSuffix: true }) : "—"}</td>
                    <td>{product.lastError ? <span className="error">{truncate(product.lastError, 160)}</span> : "—"}</td>
                  </tr>
                );
              })}
              {!products.length ? <tr><td colSpan={7}>No products found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/products"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={{ q, status, stock }}
        />
      </section>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className={`metric-card ${tone === "danger" ? "metric-danger" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value.toLocaleString()}</div>
    </div>
  );
}
