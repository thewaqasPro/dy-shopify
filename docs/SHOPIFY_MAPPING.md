# Shopify mapping

| Boss Logics | Shopify / local system |
| --- | --- |
| `_id` | Product custom ID metafield `bosslogics.external_id` |
| `f_1928` name | Product title |
| `f_1929` description | Product description HTML |
| `f_1933` SKU | Variant SKU |
| `f_1923` UPC | Variant barcode |
| `f_1947` USD price | Variant price |
| `f_1939` stock | Eligibility flag; only in-stock products are synced |
| `f_1924` classification | Product type + tag + metafield |
| `f_1927` collection | Tag + metafield |
| `f_2025` metal label | Tag + metafield |
| image fields | Local `ProductMedia` records + Shopify product media upload |
| full mapped source | Local `ProductRecord.raw` JSON for future comparison/debugging |
| fixed value | Product vendor `David Yurman` |

## Identity strategy

The sync never relies on title matching. It uses a Shopify ID metafield:

```text
namespace: bosslogics
key: external_id
type: id
value: Boss Logics _id
```

This allows safe idempotent upserts. UPC and SKU are stored as additional metadata, but they are not the primary sync key.

## Stock behavior

The current sync path is intentionally in-stock only:

- In feed and in stock: create/update as configured by `SHOPIFY_PRODUCT_STATUS`.
- New out-of-stock products: ignored and not created locally.
- Previously known products that become out of stock: marked `OUT_OF_STOCK` locally and hidden from default dashboard/products views.
- Missing from feed: mark missing locally first, then archive after the configured grace period.
- Hard delete is intentionally not implemented in the default path.

## Images

Boss Logics image fields are normalized into source URLs and stored in `ProductRecord.imageUrl` plus related `ProductMedia` rows. The UI displays those stored source URLs immediately. During live Shopify sync, pending media records are uploaded to Shopify using the product media service.
