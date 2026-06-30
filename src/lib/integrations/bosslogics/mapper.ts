import { getEnv } from "@/lib/env";
import { asMoney, compact, normalizeUrl, uniqueStrings } from "@/lib/utils";
import type { BossLogicsProduct, BossLogicsRawRecord, NormalizedProduct } from "./types";

const FIELD_MAPPING: Record<string, keyof Omit<BossLogicsProduct, "raw">> = {
  _id: "bossId",
  f_1920: "division",
  f_1924: "classification",
  f_1927: "collection",
  f_2163: "collectionCopy",
  f_1921: "styleCode",
  f_1922: "siblingCode",
  f_1933: "sku",
  f_1923: "upc",
  f_1925: "launchYear",
  f_1926: "launchDate",
  f_1928: "name",
  f_1929: "description",
  f_1930: "origin",
  f_1931: "pdpUrlAvailable",
  f_1947: "priceUsd",
  f_1948: "priceHkd",
  f_1949: "priceCad",
  f_2160: "priceNzd",
  f_2024: "metalCode",
  f_2025: "metalLabel",
  f_2026: "diamondWeight",
  f_2023: "size",
  f_2035: "claspType",
  f_1951: "retailer",
  f_1952: "retailerCode",
  f_1939: "stock",
  f_1932: "image",
  f_1934: "imageAlt1",
  f_1935: "imageAlt2",
  f_1936: "imageAlt3",
  f_1937: "imageAlt4",
  f_2021: "imageOnModel",
  f_2042: "video",
  f_2043: "videoOm"
};

function valueToString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return String(value).trim();
}

export function mapBossLogicsRecord(record: BossLogicsRawRecord): BossLogicsProduct | null {
  const mapped: Partial<BossLogicsProduct> = { raw: record };

  for (const [sourceKey, targetKey] of Object.entries(FIELD_MAPPING)) {
    const value = valueToString(record[sourceKey]);
    if (value !== undefined) {
      (mapped as Record<string, unknown>)[targetKey] = value;
    }
  }

  if (!mapped.bossId) return null;
  if (!mapped.name) mapped.name = mapped.sku ?? mapped.upc ?? `Boss Logics ${mapped.bossId}`;

  return mapped as BossLogicsProduct;
}

function buildDescriptionHtml(product: BossLogicsProduct) {
  const pieces = compact([
    product.description ? `<p>${escapeHtml(product.description)}</p>` : null,
    product.metalLabel ? `<p><strong>Metal:</strong> ${escapeHtml(product.metalLabel)}</p>` : null,
    product.size ? `<p><strong>Size:</strong> ${escapeHtml(product.size)}</p>` : null,
    product.diamondWeight ? `<p><strong>Diamond weight:</strong> ${escapeHtml(product.diamondWeight)}</p>` : null,
    product.collection ? `<p><strong>Collection:</strong> ${escapeHtml(product.collection)}</p>` : null
  ]);

  return pieces.join("\n");
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeProduct(product: BossLogicsProduct): NormalizedProduct {
  const env = getEnv();
  const imageUrls = uniqueStrings([
    normalizeUrl(product.image, env.BOSS_LOGICS_STATIC_BASE_URL),
    normalizeUrl(product.imageAlt1, env.BOSS_LOGICS_STATIC_BASE_URL),
    normalizeUrl(product.imageAlt2, env.BOSS_LOGICS_STATIC_BASE_URL),
    normalizeUrl(product.imageAlt3, env.BOSS_LOGICS_STATIC_BASE_URL),
    normalizeUrl(product.imageAlt4, env.BOSS_LOGICS_STATIC_BASE_URL),
    normalizeUrl(product.imageOnModel, env.BOSS_LOGICS_STATIC_BASE_URL)
  ]);

  const inStock = product.stock === "1" || product.stock?.toLowerCase() === "true";

  const tags = uniqueStrings([
    "bosslogics",
    "david-yurman",
    product.division,
    product.classification,
    product.collection,
    product.metalLabel,
    product.size ? `size:${product.size}` : null,
    product.styleCode ? `style:${product.styleCode}` : null
  ]);

  const metafields = compact([
    { namespace: "bosslogics", key: "external_id", type: "id", value: product.bossId },
    product.upc ? { namespace: "bosslogics", key: "upc", type: "single_line_text_field", value: product.upc } : null,
    product.sku ? { namespace: "bosslogics", key: "sku", type: "single_line_text_field", value: product.sku } : null,
    product.styleCode ? { namespace: "bosslogics", key: "style_code", type: "single_line_text_field", value: product.styleCode } : null,
    product.collection ? { namespace: "bosslogics", key: "collection", type: "single_line_text_field", value: product.collection } : null,
    product.classification ? { namespace: "bosslogics", key: "classification", type: "single_line_text_field", value: product.classification } : null,
    product.metalLabel ? { namespace: "bosslogics", key: "metal", type: "single_line_text_field", value: product.metalLabel } : null,
    product.size ? { namespace: "bosslogics", key: "size", type: "single_line_text_field", value: product.size } : null,
    product.launchDate ? { namespace: "bosslogics", key: "launch_date", type: "single_line_text_field", value: product.launchDate } : null
  ]);

  return {
    externalId: product.bossId,
    title: product.name,
    descriptionHtml: buildDescriptionHtml(product),
    sku: product.sku ?? null,
    barcode: product.upc ?? null,
    price: asMoney(product.priceUsd),
    vendor: env.SHOPIFY_VENDOR,
    productType: product.classification ?? product.division ?? null,
    status: inStock ? env.SHOPIFY_PRODUCT_STATUS : env.SHOPIFY_OUT_OF_STOCK_STATUS,
    inStock,
    stockRaw: product.stock ?? null,
    tags,
    imageUrls,
    metafields,
    source: product
  };
}
