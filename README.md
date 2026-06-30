# David Yurman Boss Logics → Shopify Inventory System

A full-stack Node.js/TypeScript inventory sync app for syncing **in-stock** Boss Logics David Yurman products into Shopify.

## What this replaces

This app removes the old WordPress/WooCommerce/SFTP pipeline. Shopify is the system of record for products, media, status, and merchandising.

## Architecture

- Next.js App Router admin UI
- PostgreSQL via Prisma
- Redis + BullMQ worker for long-running sync jobs
- Shopify GraphQL Admin API
- Boss Logics feed client and field mapper
- Dry-run mode, run history, product state, per-product logs
- Image source URLs stored locally and synced to Shopify media
- Product detail pages with raw Boss Logics data
- Pagination on product, sync-run, and event tables
- Dedicated vendor mapping: `David Yurman`

## Current stock behavior

The sync is intentionally **in-stock only**:

- In-stock Boss Logics products are stored locally and synced to Shopify.
- New out-of-stock feed products are ignored and not created locally.
- Already-known products that become out of stock are marked `OUT_OF_STOCK` locally so they disappear from the default dashboard/products view.
- Out-of-stock products are not created or updated in Shopify by the normal sync path.
- Product pages and filters still let you inspect old out-of-stock local records when needed.

## Shopify requirements

Create a Shopify custom app with these Admin API scopes:

- `read_products`
- `write_products`
- `read_inventory`
- `write_inventory` if you later enable quantity/location-level inventory updates

This app uses Shopify GraphQL Admin API. REST is avoided because Shopify marks REST Admin API as legacy and newer features may be GraphQL-only.

## Local setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
npm run dev:worker
```

Open `http://localhost:3000`, log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run a dry-run first.

## Dokploy VPS deployment

1. Create a new Dokploy Compose project.
2. Push this repository to GitHub or upload it to your VPS.
3. Use `docker-compose.yml` as the Compose file.
4. Add the environment variables from `.env.example` in Dokploy.
5. Set your domain to the `web` service on port `3000`.
6. Deploy.
7. Run the first sync in **dry-run** mode from the dashboard.
8. Review product, image, and event records.
9. Run live sync when the dry-run output looks correct.

## Safety model

- Products are matched by Shopify custom ID metafield: `bosslogics.external_id`.
- UPC is mapped to Shopify `barcode`, not SKU.
- Boss Logics SKU is mapped to Shopify `sku`.
- Missing in-stock products are not deleted. They are marked missing locally, then archived after `SHOPIFY_ARCHIVE_MISSING_AFTER_DAYS`.
- Out-of-stock feed products are ignored for Shopify sync.
- Live writes are blocked when dry-run is enabled.
- Raw Boss Logics records are saved in `ProductRecord.raw` for future comparison/debugging.

## Important setup notes

Do not commit `.env`. Put cookies, referer, Shopify token, and admin password in Dokploy environment variables/secrets.

If a real `.env` was ever shared or zipped, rotate the Shopify Admin API token and Boss Logics session/cookie before production use.

## Commands

```bash
npm run dev           # Next.js UI
npm run dev:worker    # Worker in development
npm run build         # Prisma generate + Next.js build
npm run start         # Production web
npm run worker        # Production worker
npm run prisma:studio # DB browser
```
# dy-shopify
