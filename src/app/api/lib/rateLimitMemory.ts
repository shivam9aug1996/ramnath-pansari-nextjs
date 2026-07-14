/**
 * Edge-safe fixed-window rate limiter (in-memory).
 * Used from Next.js middleware — Redis is not available on the Edge runtime.
 *
 * For durable / multi-instance limits from Route Handlers, use `rateLimit.ts`
 * (`enforceRateLimit`) which prefers Redis.
 */

import type { RateLimitPolicy } from "./rateLimitPolicies";

type MemoryBucket = {
  count: number;
  windowStart: number;
};

type RateLimitGlobal = typeof globalThis & {
  __ramnathRateLimitBuckets?: Map<string, MemoryBucket>;
};

/** Persist across middleware invocations (module scope can reset in Edge/dev). */
function getBuckets(): Map<string, MemoryBucket> {
  const g = globalThis as RateLimitGlobal;
  if (!g.__ramnathRateLimitBuckets) {
    g.__ramnathRateLimitBuckets = new Map();
  }
  return g.__ramnathRateLimitBuckets;
}

export type RateLimitConsumeResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the current window resets */
  resetAt: number;
};

function windowKey(policy: RateLimitPolicy, identity: string, windowStart: number) {
  return `${policy.keyPrefix}:${identity}:${windowStart}`;
}

export function consumeMemoryRateLimit(
  policy: RateLimitPolicy,
  identity: string,
  now = Date.now(),
): RateLimitConsumeResult {
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const resetAt = windowStart + policy.windowMs;
  const key = windowKey(policy, identity, windowStart);
  const buckets = getBuckets();

  // Drop very old keys occasionally to avoid unbounded growth
  if (buckets.size > 5_000) {
    buckets.forEach((v, k) => {
      if (v.windowStart + policy.windowMs < now) buckets.delete(k);
    });
  }

  const existing = buckets.get(key);
  if (!existing) {
    buckets.set(key, { count: 1, windowStart });
    return {
      allowed: true,
      limit: policy.max,
      remaining: Math.max(policy.max - 1, 0),
      resetAt,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= policy.max;
  return {
    allowed,
    limit: policy.max,
    remaining: Math.max(policy.max - existing.count, 0),
    resetAt,
  };
}
