import { Prisma, ProductSyncStatus, SyncRunMode } from "@prisma/client";
import { subDays } from "date-fns";
import { getEnv } from "@/lib/env";
import { BossLogicsClient } from "@/lib/integrations/bosslogics/client";
import type { NormalizedProduct } from "@/lib/integrations/bosslogics/types";
import { ShopifyCatalogService } from "@/lib/integrations/shopify/service";
import { prisma } from "@/lib/prisma";
import { sleep } from "@/lib/utils";
import { logSyncEvent } from "./events";

type Counters = {
  createdCount: number;
  updatedCount: number;
  archivedCount: number;
  skippedCount: number;
  failedCount: number;
  missingCount: number;
  outOfStockCount: number;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function executeSyncRun(runId: string) {
  const env = getEnv();
  const run = await prisma.syncRun.findUniqueOrThrow({ where: { id: runId } });
  const dryRun = run.mode === SyncRunMode.DRY_RUN;
  const options = (run.options ?? {}) as { archiveMissing?: boolean; maxProducts?: number };
  const counters: Counters = {
    createdCount: 0,
    updatedCount: 0,
    archivedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    missingCount: 0,
    outOfStockCount: 0
  };

  await prisma.syncRun.update({ where: { id: runId }, data: { status: "RUNNING", startedAt: new Date() } });
  await logSyncEvent({ runId, eventType: "run.started", message: `Sync started in ${run.mode} mode.` });

  try {
    const bossClient = new BossLogicsClient();
    const shopify = new ShopifyCatalogService();

    if (!dryRun) {
      await shopify.ensureCustomIdDefinition();
    }

    const fetched = await bossClient.fetchProducts();
    const maxProducts = Number(options.maxProducts ?? env.SYNC_MAX_PRODUCTS_PER_RUN);
    const products = maxProducts > 0 ? fetched.slice(0, maxProducts) : fetched;
    const inStockProducts = products.filter((product) => product.inStock);
    const outOfStockProducts = products.filter((product) => !product.inStock);
    const seenIds = new Set(products.map((product) => product.externalId));

    counters.outOfStockCount = outOfStockProducts.length;

    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        totalRaw: fetched.length,
        totalEligible: inStockProducts.length,
        outOfStockCount: counters.outOfStockCount
      }
    });

    await logSyncEvent({
      runId,
      eventType: "bosslogics.fetched",
      message: `Fetched ${fetched.length} products from Boss Logics; ${inStockProducts.length} are in stock and eligible. Out-of-stock products are ignored for Shopify sync.`,
      data: { maxProducts, processed: products.length, ignoredOutOfStock: outOfStockProducts.length }
    });

    for (const product of outOfStockProducts) {
      await markKnownOutOfStockProduct(product, runId, counters);
    }

    for (const product of inStockProducts) {
      await upsertLocalProduct(product, runId);
    }

    for (const product of inStockProducts) {
      await syncOneProduct(product, runId, dryRun, shopify, counters);
      await updateRunCounters(runId, counters);
      await sleep(env.SYNC_BATCH_DELAY_MS);
    }

    await handleMissingProducts({ runId, seenIds, dryRun, shopify, counters, archiveMissing: options.archiveMissing !== false });

    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        message: counters.failedCount > 0 ? `Completed with ${counters.failedCount} product errors.` : "Completed successfully.",
        ...counters
      }
    });

    await logSyncEvent({ runId, level: "SUCCESS", eventType: "run.completed", message: "Sync completed." });
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        failedCount: { increment: 1 },
        message: error instanceof Error ? error.message : String(error)
      }
    });
    await logSyncEvent({
      runId,
      level: "ERROR",
      eventType: "run.failed",
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function upsertLocalProduct(product: NormalizedProduct, runId: string) {
  const record = await prisma.productRecord.upsert({
    where: { bossId: product.externalId },
    create: {
      bossId: product.externalId,
      sku: product.sku,
      upc: product.barcode,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      priceUsd: product.price ? new Prisma.Decimal(product.price) : null,
      inStock: true,
      stockRaw: product.stockRaw,
      imageUrl: product.imageUrls[0] ?? null,
      syncStatus: ProductSyncStatus.NEW,
      missingSince: null,
      lastSeenAt: new Date(),
      tags: product.tags,
      raw: toJson(product.source)
    },
    update: {
      sku: product.sku,
      upc: product.barcode,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      priceUsd: product.price ? new Prisma.Decimal(product.price) : null,
      inStock: true,
      stockRaw: product.stockRaw,
      imageUrl: product.imageUrls[0] ?? null,
      missingSince: null,
      lastSeenAt: new Date(),
      tags: product.tags,
      raw: toJson(product.source)
    }
  });

  if (product.imageUrls.length) {
    for (const sourceUrl of product.imageUrls) {
      await prisma.productMedia.upsert({
        where: { productRecordId_sourceUrl: { productRecordId: record.id, sourceUrl } },
        create: { productRecordId: record.id, sourceUrl, status: "SOURCE" },
        update: {}
      });
    }
  }

  await logSyncEvent({
    runId,
    productRecordId: record.id,
    eventType: "product.local_upserted",
    message: `Local in-stock record updated for ${product.title}.`
  });

  return record;
}

async function markKnownOutOfStockProduct(product: NormalizedProduct, runId: string, counters: Counters) {
  const existing = await prisma.productRecord.findUnique({ where: { bossId: product.externalId } });
  if (!existing) {
    return;
  }

  await prisma.productRecord.update({
    where: { id: existing.id },
    data: {
      inStock: false,
      stockRaw: product.stockRaw,
      syncStatus: ProductSyncStatus.OUT_OF_STOCK,
      lastSeenAt: new Date(),
      raw: toJson(product.source),
      imageUrl: product.imageUrls[0] ?? existing.imageUrl,
      lastError: null
    }
  });

  counters.skippedCount += 1;
  await logSyncEvent({
    runId,
    productRecordId: existing.id,
    level: "WARN",
    eventType: "product.out_of_stock_ignored",
    message: `${product.title} is out of stock in Boss Logics; ignored for Shopify sync and hidden from default inventory views.`
  });
}

async function syncOneProduct(product: NormalizedProduct, runId: string, dryRun: boolean, shopify: ShopifyCatalogService, counters: Counters) {
  const record = await prisma.productRecord.findUniqueOrThrow({ where: { bossId: product.externalId } });

  try {
    if (dryRun) {
      counters.skippedCount += 1;
      await prisma.productRecord.update({ where: { id: record.id }, data: { syncStatus: ProductSyncStatus.SKIPPED } });
      await logSyncEvent({
        runId,
        productRecordId: record.id,
        eventType: "product.dry_run",
        message: `Would upsert ${product.title} into Shopify.`,
        data: toJson({ sku: product.sku, barcode: product.barcode, price: product.price, status: product.status, imageUrls: product.imageUrls })
      });
      return;
    }

    const existing = await shopify.findByExternalId(product.externalId);
    const shopifyProduct = await shopify.upsertProduct(product, { status: getEnv().SHOPIFY_PRODUCT_STATUS });
    const action = existing ? "updated" : "created";

    if (existing) counters.updatedCount += 1;
    else counters.createdCount += 1;

    await prisma.productRecord.update({
      where: { id: record.id },
      data: {
        shopifyProductId: shopifyProduct.id,
        shopifyHandle: shopifyProduct.handle ?? null,
        shopifyStatus: shopifyProduct.status ?? product.status,
        syncStatus: ProductSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        lastError: null
      }
    });

    await logSyncEvent({
      runId,
      productRecordId: record.id,
      level: "SUCCESS",
      eventType: `product.${action}`,
      message: `${product.title} ${action} in Shopify.`,
      data: toJson({ shopifyProductId: shopifyProduct.id, handle: shopifyProduct.handle })
    });

    if (envBoolean("SHOPIFY_SYNC_MEDIA")) {
      await syncMedia(record.id, shopifyProduct.id, product, runId, shopify);
    }
  } catch (error) {
    counters.failedCount += 1;
    const message = error instanceof Error ? error.message : String(error);
    await prisma.productRecord.update({ where: { id: record.id }, data: { syncStatus: ProductSyncStatus.FAILED, lastError: message } });
    await logSyncEvent({ runId, productRecordId: record.id, level: "ERROR", eventType: "product.failed", message });
  }
}

async function syncMedia(recordId: string, shopifyProductId: string, product: NormalizedProduct, runId: string, shopify: ShopifyCatalogService) {
  const pendingMedia = await prisma.productMedia.findMany({
    where: { productRecordId: recordId, sourceUrl: { in: product.imageUrls }, shopifyMediaId: null },
    take: 10
  });

  if (!pendingMedia.length) return;

  try {
    const uploaded = await shopify.addMedia(shopifyProductId, pendingMedia.map((media) => media.sourceUrl), product.title);
    for (const [index, media] of pendingMedia.entries()) {
      await prisma.productMedia.update({
        where: { id: media.id },
        data: {
          shopifyMediaId: uploaded[index]?.id ?? null,
          status: uploaded[index]?.status ?? "UPLOADED",
          lastSyncedAt: new Date(),
          lastError: null
        }
      });
    }
    await logSyncEvent({ runId, productRecordId: recordId, level: "SUCCESS", eventType: "product.media_uploaded", message: `Uploaded ${uploaded.length} media item(s).` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.productMedia.updateMany({ where: { id: { in: pendingMedia.map((media) => media.id) } }, data: { status: "FAILED", lastError: message } });
    await logSyncEvent({ runId, productRecordId: recordId, level: "ERROR", eventType: "product.media_failed", message });
  }
}

async function handleMissingProducts(input: {
  runId: string;
  seenIds: Set<string>;
  dryRun: boolean;
  shopify: ShopifyCatalogService;
  counters: Counters;
  archiveMissing: boolean;
}) {
  const env = getEnv();
  const allKnown = await prisma.productRecord.findMany({
    where: { vendor: env.SHOPIFY_VENDOR, shopifyProductId: { not: null }, inStock: true }
  });
  const missing = allKnown.filter((record) => !input.seenIds.has(record.bossId));
  input.counters.missingCount = missing.length;

  for (const record of missing) {
    if (!record.missingSince) {
      await prisma.productRecord.update({
        where: { id: record.id },
        data: { missingSince: new Date(), syncStatus: ProductSyncStatus.MISSING }
      });
      await logSyncEvent({ runId: input.runId, productRecordId: record.id, level: "WARN", eventType: "product.marked_missing", message: `${record.title} missing from Boss Logics feed; marked missing.` });
      continue;
    }

    const canArchive = record.missingSince <= subDays(new Date(), env.SHOPIFY_ARCHIVE_MISSING_AFTER_DAYS);
    if (!input.archiveMissing || !canArchive) {
      await logSyncEvent({ runId: input.runId, productRecordId: record.id, level: "WARN", eventType: "product.missing_grace_period", message: `${record.title} still inside missing-product grace period.` });
      continue;
    }

    if (input.dryRun) {
      input.counters.skippedCount += 1;
      await logSyncEvent({ runId: input.runId, productRecordId: record.id, eventType: "product.archive_dry_run", message: `Would archive missing product ${record.title}.` });
      continue;
    }

    const pseudoProduct = {
      externalId: record.bossId,
      title: record.title,
      vendor: record.vendor,
      tags: [...record.tags, "bosslogics-missing"],
      metafields: [{ namespace: "bosslogics", key: "external_id", type: "id", value: record.bossId }]
    };
    await input.shopify.setProductStatus(pseudoProduct, "ARCHIVED");
    await prisma.productRecord.update({
      where: { id: record.id },
      data: { syncStatus: ProductSyncStatus.ARCHIVED, shopifyStatus: "ARCHIVED", lastSyncedAt: new Date() }
    });
    input.counters.archivedCount += 1;
    await logSyncEvent({ runId: input.runId, productRecordId: record.id, level: "SUCCESS", eventType: "product.archived_missing", message: `${record.title} archived after missing grace period.` });
  }

  await updateRunCounters(input.runId, input.counters);
}

async function updateRunCounters(runId: string, counters: Counters) {
  await prisma.syncRun.update({ where: { id: runId }, data: counters });
}

function envBoolean(key: "SHOPIFY_SYNC_MEDIA") {
  return getEnv()[key];
}
