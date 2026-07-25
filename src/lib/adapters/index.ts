import type { MarketplaceAdapter } from "./types";
import { shopeeAdapter } from "./shopee";
import { tiktokAdapter } from "./tiktok";
import { tokopediaAdapter } from "./tokopedia";

export const adapters: Record<string, MarketplaceAdapter> = {
  SHOPEE: shopeeAdapter,
  TIKTOK: tiktokAdapter,
  TOKOPEDIA: tokopediaAdapter,
};

export * from "./types";
