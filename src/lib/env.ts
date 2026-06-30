import { z } from "zod";

const booleanFromString = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return fallback;
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    });

const optionalInt = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return fallback;
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    });

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),

  BOSS_LOGICS_ENDPOINT: z.string().url(),
  BOSS_LOGICS_COOKIE: z.string().min(1),
  BOSS_LOGICS_REFERER: z.string().min(1),
  BOSS_LOGICS_STATIC_BASE_URL: z.string().url().default("https://static.dy.cloud.bosslogics.com"),

  SHOPIFY_SHOP: z.string().min(1),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().default("2026-04"),
  SHOPIFY_VENDOR: z.string().default("David Yurman"),
  SHOPIFY_PRODUCT_STATUS: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("ACTIVE"),
  SHOPIFY_OUT_OF_STOCK_STATUS: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("DRAFT"),
  SHOPIFY_ARCHIVE_MISSING_AFTER_DAYS: optionalInt(7),
  SHOPIFY_SYNC_MEDIA: booleanFromString(true),
  SHOPIFY_PUBLISH_ON_CREATE: booleanFromString(false),

  SYNC_QUEUE_NAME: z.string().default("dy-shopify-sync"),
  SYNC_CONCURRENCY: optionalInt(2),
  SYNC_CRON_ENABLED: booleanFromString(false),
  SYNC_CRON: z.string().default("*/30 * * * *"),
  SYNC_DEFAULT_DRY_RUN: booleanFromString(true),
  SYNC_MAX_PRODUCTS_PER_RUN: optionalInt(0),
  SYNC_BATCH_DELAY_MS: optionalInt(250),
  ARCHIVE_OUT_OF_STOCK: booleanFromString(true)
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
      throw new Error(`Invalid environment configuration:\n${message}`);
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}

export type AppEnv = ReturnType<typeof getEnv>;
