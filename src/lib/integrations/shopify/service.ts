import { getEnv } from "@/lib/env";
import type { NormalizedProduct } from "@/lib/integrations/bosslogics/types";
import { ShopifyGraphQLClient } from "./client";
import { CREATE_METAFIELD_DEFINITION, PRODUCT_BY_CUSTOM_ID, PRODUCT_CREATE_MEDIA, PRODUCT_SET } from "./queries";
import type { ProductSetResult, ShopifyProductSummary, ShopifyUserError } from "./types";

function throwUserErrors(context: string, errors: ShopifyUserError[]) {
  if (!errors.length) return;
  throw new Error(`${context}: ${errors.map((error) => `${error.field?.join(".") ?? "field"}: ${error.message}`).join("; ")}`);
}

function customIdIdentifier(externalId: string) {
  return {
    customId: {
      namespace: "bosslogics",
      key: "external_id",
      value: externalId
    }
  };
}

export class ShopifyCatalogService {
  private client = new ShopifyGraphQLClient();

  async ensureCustomIdDefinition() {
    const data = await this.client.request<{
      metafieldDefinitionCreate: {
        createdDefinition: { id: string } | null;
        userErrors: ShopifyUserError[];
      };
    }>(CREATE_METAFIELD_DEFINITION, {
      definition: {
        name: "Boss Logics External ID",
        namespace: "bosslogics",
        key: "external_id",
        type: "id",
        ownerType: "PRODUCT",
        description: "Unique Boss Logics product identifier used by the sync app."
      }
    });

    const errors = data.metafieldDefinitionCreate.userErrors;
    const blocking = errors.filter((error) => !/already exists/i.test(error.message));
    throwUserErrors("Create Boss Logics custom ID metafield definition", blocking);
  }

  async findByExternalId(externalId: string): Promise<ShopifyProductSummary | null> {
    const data = await this.client.request<{ productByIdentifier: ShopifyProductSummary | null }>(PRODUCT_BY_CUSTOM_ID, {
      namespace: "bosslogics",
      key: "external_id",
      value: externalId
    });
    return data.productByIdentifier;
  }

  async upsertProduct(product: NormalizedProduct, options?: { status?: "ACTIVE" | "DRAFT" | "ARCHIVED" }) {
    const status = options?.status ?? product.status;
    const input = this.toProductSetInput(product, status);

    const data = await this.client.request<ProductSetResult>(PRODUCT_SET, {
      input,
      identifier: customIdIdentifier(product.externalId),
      synchronous: true
    });

    throwUserErrors(`Upsert Shopify product ${product.externalId}`, data.productSet.userErrors);
    if (!data.productSet.product) {
      throw new Error(`Shopify did not return a product for ${product.externalId}`);
    }

    return data.productSet.product;
  }

  async setProductStatus(product: Pick<NormalizedProduct, "externalId" | "title" | "vendor" | "tags" | "metafields">, status: "ACTIVE" | "DRAFT" | "ARCHIVED") {
    const data = await this.client.request<ProductSetResult>(PRODUCT_SET, {
      input: {
        title: product.title,
        vendor: product.vendor,
        status,
        tags: [...new Set([...product.tags, status === "ARCHIVED" ? "bosslogics-archived" : "bosslogics-status-updated"])],
        metafields: product.metafields
      },
      identifier: customIdIdentifier(product.externalId),
      synchronous: true
    });

    throwUserErrors(`Set Shopify product ${product.externalId} status`, data.productSet.userErrors);
    return data.productSet.product;
  }

  async addMedia(productId: string, mediaUrls: string[], altText: string) {
    if (!mediaUrls.length) return [];
    const data = await this.client.request<{
      productCreateMedia: {
        media: Array<{ id: string; status: string; mediaContentType: string }>;
        mediaUserErrors: ShopifyUserError[];
      };
    }>(PRODUCT_CREATE_MEDIA, {
      productId,
      media: mediaUrls.map((url) => ({
        originalSource: url,
        mediaContentType: "IMAGE",
        alt: altText
      }))
    });

    throwUserErrors(`Create media for ${productId}`, data.productCreateMedia.mediaUserErrors);
    return data.productCreateMedia.media;
  }

  private toProductSetInput(product: NormalizedProduct, status: "ACTIVE" | "DRAFT" | "ARCHIVED") {
    const variant: Record<string, unknown> = {
      optionValues: [{ optionName: "Title", name: "Default Title" }]
    };

    if (product.price) variant.price = product.price;
    if (product.sku) variant.sku = product.sku;
    if (product.barcode) variant.barcode = product.barcode;

    return {
      title: product.title,
      descriptionHtml: product.descriptionHtml,
      vendor: getEnv().SHOPIFY_VENDOR,
      productType: product.productType,
      status,
      tags: product.tags,
      metafields: product.metafields,
      productOptions: [
        {
          name: "Title",
          position: 1,
          values: [{ name: "Default Title" }]
        }
      ],
      variants: [variant]
    };
  }
}
