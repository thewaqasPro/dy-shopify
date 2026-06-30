import { getEnv } from "@/lib/env";
import { sleep } from "@/lib/utils";

type GraphQLError = { message: string; extensions?: Record<string, unknown> };
type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      actualQueryCost?: number;
      throttleStatus?: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
};

export class ShopifyGraphQLClient {
  private endpoint: string;

  constructor() {
    const env = getEnv();
    const shop = env.SHOPIFY_SHOP.replace(/^https?:\/\//, "").replace(/\/$/, "");
    this.endpoint = `https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;
  }

  async request<T>(query: string, variables?: Record<string, unknown>, attempt = 1): Promise<T> {
    const env = getEnv();

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const text = await response.text();
    let json: GraphQLResponse<T>;
    try {
      json = JSON.parse(text) as GraphQLResponse<T>;
    } catch {
      throw new Error(`Invalid Shopify response: ${response.status} ${text.slice(0, 500)}`);
    }

    if ((response.status === 429 || response.status >= 500) && attempt <= 5) {
      await sleep(750 * attempt ** 2);
      return this.request<T>(query, variables, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`Shopify GraphQL HTTP ${response.status}: ${text.slice(0, 1000)}`);
    }

    if (json.errors?.length) {
      const messages = json.errors.map((error) => error.message).join("; ");
      throw new Error(`Shopify GraphQL error: ${messages}`);
    }

    const throttle = json.extensions?.cost?.throttleStatus;
    if (throttle && throttle.currentlyAvailable < 100) {
      const waitMs = Math.ceil(((100 - throttle.currentlyAvailable) / Math.max(throttle.restoreRate, 1)) * 1000);
      await sleep(Math.min(waitMs, 3000));
    }

    if (!json.data) {
      throw new Error("Shopify GraphQL returned no data.");
    }

    return json.data;
  }
}
