import { getEnv } from "@/lib/env";
import { mapBossLogicsRecord, normalizeProduct } from "./mapper";
import type { BossLogicsRawRecord, NormalizedProduct } from "./types";

export class BossLogicsClient {
  async fetchProducts(): Promise<NormalizedProduct[]> {
    const env = getEnv();
    const response = await fetch(env.BOSS_LOGICS_ENDPOINT, {
      headers: {
        Cookie: env.BOSS_LOGICS_COOKIE,
        Referer: env.BOSS_LOGICS_REFERER,
        "Referrer-Policy": "strict-origin-when-cross-origin",
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Boss Logics request failed: ${response.status} ${response.statusText} ${body.slice(0, 500)}`);
    }

    const data = (await response.json()) as { dat?: BossLogicsRawRecord[] };
    const records = Array.isArray(data.dat) ? data.dat : [];

    return records
      .map(mapBossLogicsRecord)
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .map(normalizeProduct);
  }
}
