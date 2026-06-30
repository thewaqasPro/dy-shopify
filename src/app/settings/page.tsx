import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/lib/ui/app-shell";
import { StatusBadge } from "@/lib/ui/badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const env = getEnv();
  const [runs, products, inStockProducts, failedInStockProducts, mediaRecords] = await Promise.all([
    prisma.syncRun.count(),
    prisma.productRecord.count(),
    prisma.productRecord.count({ where: { inStock: true } }),
    prisma.productRecord.count({ where: { inStock: true, syncStatus: "FAILED" } }),
    prisma.productMedia.count()
  ]);

  const checks = [
    ["Shopify shop", env.SHOPIFY_SHOP],
    ["Shopify API version", env.SHOPIFY_API_VERSION],
    ["Vendor", env.SHOPIFY_VENDOR],
    ["Default Shopify product status", env.SHOPIFY_PRODUCT_STATUS],
    ["Out-of-stock handling", "Ignored for Shopify sync; hidden from default product views"],
    ["Archive missing after days", String(env.SHOPIFY_ARCHIVE_MISSING_AFTER_DAYS)],
    ["Media sync", env.SHOPIFY_SYNC_MEDIA ? "enabled" : "disabled"],
    ["Cron", env.SYNC_CRON_ENABLED ? env.SYNC_CRON : "disabled"],
    ["Default dry-run", env.SYNC_DEFAULT_DRY_RUN ? "enabled" : "disabled"],
    ["Products in DB", String(products)],
    ["In-stock products", String(inStockProducts)],
    ["Stored media records", String(mediaRecords)],
    ["Sync runs", String(runs)],
    ["Failed in-stock products", String(failedInStockProducts)]
  ];

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">System</span>
          <h1>Settings</h1>
          <p>Runtime configuration is loaded from environment variables for secure Dokploy deployment.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Configuration</h2>
        {checks.map(([label, value]) => (
          <div className="kv" key={label}>
            <span className="helper">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Deployment checklist</h2>
        <div className="grid">
          <p><StatusBadge value="required" /> Shopify custom app token must include product read/write scopes.</p>
          <p><StatusBadge value="required" /> Boss Logics credentials must stay in Dokploy environment variables/secrets.</p>
          <p><StatusBadge value="recommended" /> Run at least one dry-run before a live sync.</p>
          <p><StatusBadge value="recommended" /> Default product tables intentionally show in-stock products only.</p>
          <p><StatusBadge value="recommended" /> Product detail pages keep raw Boss Logics data for future comparisons/debugging.</p>
        </div>
      </section>
    </AppShell>
  );
}
