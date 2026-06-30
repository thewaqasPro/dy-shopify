export type ShopifyUserError = {
  field?: string[] | null;
  message: string;
  code?: string | null;
};

export type ShopifyProductSummary = {
  id: string;
  title: string;
  handle?: string | null;
  status?: string | null;
  vendor?: string | null;
  variants?: {
    nodes: Array<{
      id: string;
      sku?: string | null;
      barcode?: string | null;
      price?: string | null;
    }>;
  };
};

export type ProductSetResult = {
  productSet: {
    product: ShopifyProductSummary | null;
    userErrors: ShopifyUserError[];
  };
};
