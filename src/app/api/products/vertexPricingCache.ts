import RedisClient from "../lib/redisClient";
import { log } from "../lib/logger";
import type { VertexPricingResult } from "./jiomartVertex";

const CACHE_PREFIX = "vertex:price:";
const DEFAULT_TTL_SEC = parseInt(
  process.env.VERTEX_PRICE_CACHE_TTL_SEC || "600",
  10,
);

function cacheKey(jiomartUid: string) {
  return `${CACHE_PREFIX}${jiomartUid}`;
}

export async function getVertexPricingFromCache(
  jiomartUid: string,
): Promise<VertexPricingResult | null> {
  if (!jiomartUid) return null;

  try {
    const redis = await RedisClient.getInstance();
    const raw = await redis.get(cacheKey(jiomartUid));
    if (!raw) return null;
    const pricing = JSON.parse(raw) as VertexPricingResult;
    log("[jiomart] Redis pricing cache hit", {
      jiomartUid,
      mrp: pricing.price ?? null,
      sellingPrice: pricing.discountedPrice ?? null,
      hasPrice: Boolean(pricing.price && pricing.discountedPrice),
    });
    return pricing;
  } catch {
    return null;
  }
}

export async function setVertexPricingCache(
  jiomartUid: string,
  pricing: VertexPricingResult,
): Promise<void> {
  if (!jiomartUid || !pricing.matched) return;

  try {
    const redis = await RedisClient.getInstance();
    await redis.set(cacheKey(jiomartUid), JSON.stringify(pricing), {
      EX: DEFAULT_TTL_SEC,
    });
    log("[jiomart] Redis pricing cache set", {
      jiomartUid,
      ttlSec: DEFAULT_TTL_SEC,
      mrp: pricing.price ?? null,
      sellingPrice: pricing.discountedPrice ?? null,
      hasPrice: Boolean(pricing.price && pricing.discountedPrice),
    });
  } catch {}
}

export async function invalidateVertexPricingCache(
  jiomartUids: string[],
): Promise<void> {
  if (!jiomartUids.length) return;

  try {
    const redis = await RedisClient.getInstance();
    await redis.del(jiomartUids.map(cacheKey));
  } catch {}
}
