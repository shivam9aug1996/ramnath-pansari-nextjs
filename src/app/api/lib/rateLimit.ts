import { NextResponse } from "next/server";
import RedisClient from "@/app/api/lib/redisClient";
import {
  getRateLimitPolicy,
  type RateLimitPolicy,
  type RateLimitPolicyId,
} from "@/app/api/lib/rateLimitPolicies";
import {
  consumeMemoryRateLimit,
  type RateLimitConsumeResult,
} from "@/app/api/lib/rateLimitMemory";

export type { RateLimitConsumeResult };

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

async function consumeRedisRateLimit(
  policy: RateLimitPolicy,
  identity: string,
  now = Date.now(),
): Promise<RateLimitConsumeResult> {
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const resetAt = windowStart + policy.windowMs;
  const key = `${policy.keyPrefix}:${identity}:${windowStart}`;
  const ttlSec = Math.max(Math.ceil(policy.windowMs / 1000), 1);

  const redis = await RedisClient.getInstance();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSec);
  }

  const allowed = count <= policy.max;
  return {
    allowed,
    limit: policy.max,
    remaining: Math.max(policy.max - count, 0),
    resetAt,
  };
}

/**
 * Prefer Redis (shared across Vercel instances). Falls back to memory if Redis is down.
 */
export async function consumeRateLimit(
  policyId: RateLimitPolicyId,
  identity: string,
): Promise<RateLimitConsumeResult> {
  const policy = getRateLimitPolicy(policyId);
  if (policy.enabled === false) {
    return {
      allowed: true,
      limit: policy.max,
      remaining: policy.max,
      resetAt: Date.now() + policy.windowMs,
    };
  }

  try {
    return await consumeRedisRateLimit(policy, identity);
  } catch (error) {
    console.warn("[rateLimit] Redis unavailable — using memory fallback", error);
    return consumeMemoryRateLimit(policy, identity);
  }
}

function rateLimitResponse(result: RateLimitConsumeResult): NextResponse {
  const retryAfterSec = Math.max(
    Math.ceil((result.resetAt - Date.now()) / 1000),
    1,
  );
  return NextResponse.json(
    {
      error: {
        code: "429",
        message: "Too Many Requests",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

/**
 * Use in Route Handlers for custom / Redis-backed limits.
 * @returns NextResponse (429) when blocked, otherwise null
 *
 * @example
 * const limited = await enforceRateLimit(req, "apiGeneral");
 * if (limited) return limited;
 */
export async function enforceRateLimit(
  req: Request,
  policyId: RateLimitPolicyId,
  identity = getClientIp(req),
): Promise<NextResponse | null> {
  const result = await consumeRateLimit(policyId, identity);
  if (result.allowed) return null;
  return rateLimitResponse(result);
}
