import RedisClient from "@/app/api/lib/redisClient";
import { OrderStatus } from "@/app/api/order/orderStatus";
import { logError } from "@/app/api/lib/logger";

export const CHECKOUT_HOLD_TTL_SECONDS = 15 * 60;
export const ORDER_HOLD_TTL_SECONDS = 1 * 60 * 60;

const KEY_PREFIX = "jiomart_pending:product:";
const LOG_PREFIX = "[product-lock]";

function lockLog(step: string, data?: Record<string, unknown>) {
  console.log(LOG_PREFIX, step, data ?? {});
}

export type ProductLockPhase = "checkout" | "order";

export type ProductLockValue = {
  userId: string;
  orderId: string | null;
  phase: ProductLockPhase;
  heldAt: string;
};

export type HeldProduct = {
  productId: string;
  reason: "order_in_progress" | "checkout_in_progress" | "hold_expired";
};

export type AcquireCheckoutHoldsResult =
  | { ok: true; heldProducts: [] }
  | { ok: false; heldProducts: HeldProduct[] };

export type CommitOrderLocksResult =
  | { ok: true }
  | { ok: false; code: "ITEMS_ON_HOLD" | "HOLD_EXPIRED"; heldProducts: HeldProduct[] };

export function pendingProductKey(productId: string) {
  return `${KEY_PREFIX}${productId}`;
}

export function extractProductIdsFromCart(cartData: {
  cart?: { items?: Array<{ productId?: unknown; productDetails?: { _id?: unknown } }> };
}): string[] {
  const ids =
    cartData?.cart?.items
      ?.map((item) => {
        const fromDetails = item?.productDetails?._id;
        const raw = fromDetails ?? item?.productId;
        return raw != null ? String(raw) : "";
      })
      .filter(Boolean) ?? [];

  return Array.from(new Set(ids));
}

function parseLock(raw: string | null): ProductLockValue | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProductLockValue;
    if (!parsed?.userId || !parsed?.phase) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildLockValue(
  userId: string,
  phase: ProductLockPhase,
  orderId: string | null,
): string {
  return JSON.stringify({
    userId,
    orderId,
    phase,
    heldAt: new Date().toISOString(),
  });
}

export function shouldReleaseProductLocks(
  prevStatus: string,
  nextStatus: string,
): boolean {
  return (
    prevStatus === OrderStatus.CONFIRMED && nextStatus !== OrderStatus.CONFIRMED
  );
}

async function rollbackCheckoutAcquires(
  userId: string,
  productIds: string[],
  reason: string,
) {
  const redis = await RedisClient.getInstance();
  const released: string[] = [];
  for (const productId of productIds) {
    const key = pendingProductKey(productId);
    const raw = await redis.get(key);
    const lock = parseLock(raw);
    if (
      lock?.phase === "checkout" &&
      lock.userId === userId &&
      lock.orderId == null
    ) {
      await redis.del(key);
      released.push(productId);
    }
  }
  lockLog("checkout:rollback", { userId, reason, released, requested: productIds });
}

export async function releaseCheckoutHolds(
  userId: string,
  productIds: string[],
  reason: string,
) {
  await rollbackCheckoutAcquires(userId, productIds, reason);
}

export async function acquireCheckoutHolds(
  userId: string,
  productIds: string[],
): Promise<AcquireCheckoutHoldsResult> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  lockLog("checkout:acquire:start", { userId, productIds: uniqueIds });
  if (uniqueIds.length === 0) {
    return { ok: true, heldProducts: [] };
  }

  try {
    const redis = await RedisClient.getInstance();
    const heldProducts: HeldProduct[] = [];
    const toAcquire: string[] = [];
    const toRefresh: string[] = [];

    for (const productId of uniqueIds) {
      const raw = await redis.get(pendingProductKey(productId));
      const lock = parseLock(raw);

      if (!lock) {
        toAcquire.push(productId);
        continue;
      }

      if (lock.phase === "order") {
        heldProducts.push({ productId, reason: "order_in_progress" });
        lockLog("checkout:acquire:blocked", {
          userId,
          productId,
          reason: "order_in_progress",
          lock,
        });
        continue;
      }

      if (lock.userId === userId) {
        toRefresh.push(productId);
        lockLog("checkout:acquire:refresh", { userId, productId, lock });
        continue;
      }

      heldProducts.push({ productId, reason: "checkout_in_progress" });
      lockLog("checkout:acquire:blocked", {
        userId,
        productId,
        reason: "checkout_in_progress",
        lock,
      });
    }

    if (heldProducts.length > 0) {
      lockLog("checkout:acquire:failed", { userId, heldProducts });
      return { ok: false, heldProducts };
    }

    const checkoutValue = buildLockValue(userId, "checkout", null);
    const acquired: string[] = [];

    for (const productId of toAcquire) {
      const key = pendingProductKey(productId);
      const created = await redis.set(key, checkoutValue, {
        NX: true,
        EX: CHECKOUT_HOLD_TTL_SECONDS,
      });

      if (!created) {
        heldProducts.push({ productId, reason: "checkout_in_progress" });
        lockLog("checkout:acquire:race-lost", { userId, productId });
        await rollbackCheckoutAcquires(userId, acquired, "acquire-race");
        return { ok: false, heldProducts };
      }

      acquired.push(productId);
      lockLog("checkout:acquire:created", {
        userId,
        productId,
        ttl: CHECKOUT_HOLD_TTL_SECONDS,
      });
    }

    for (const productId of toRefresh) {
      const key = pendingProductKey(productId);
      await redis.set(key, checkoutValue, { EX: CHECKOUT_HOLD_TTL_SECONDS });
      lockLog("checkout:acquire:ttl-refreshed", {
        userId,
        productId,
        ttl: CHECKOUT_HOLD_TTL_SECONDS,
      });
    }

    lockLog("checkout:acquire:success", {
      userId,
      acquired,
      refreshed: toRefresh,
    });
    return { ok: true, heldProducts: [] };
  } catch (error) {
    logError(`${LOG_PREFIX} checkout:acquire:error`, error);
    throw error;
  }
}

export async function validateCheckoutHoldsForPayment(
  userId: string,
  productIds: string[],
): Promise<AcquireCheckoutHoldsResult> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  lockLog("payment:validate:start", { userId, productIds: uniqueIds });
  if (uniqueIds.length === 0) {
    return { ok: true, heldProducts: [] };
  }

  try {
    const redis = await RedisClient.getInstance();
    const heldProducts: HeldProduct[] = [];

    for (const productId of uniqueIds) {
      const raw = await redis.get(pendingProductKey(productId));
      const lock = parseLock(raw);

      if (!lock) {
        heldProducts.push({ productId, reason: "hold_expired" });
        lockLog("payment:validate:failed", {
          userId,
          productId,
          reason: "hold_expired",
        });
        continue;
      }

      if (lock.phase === "order") {
        heldProducts.push({ productId, reason: "order_in_progress" });
        lockLog("payment:validate:failed", {
          userId,
          productId,
          reason: "order_in_progress",
          lock,
        });
        continue;
      }

      if (lock.userId !== userId) {
        heldProducts.push({ productId, reason: "checkout_in_progress" });
        lockLog("payment:validate:failed", {
          userId,
          productId,
          reason: "checkout_in_progress",
          lock,
        });
      }
    }

    if (heldProducts.length > 0) {
      lockLog("payment:validate:blocked", { userId, heldProducts });
      return { ok: false, heldProducts };
    }

    lockLog("payment:validate:success", { userId, productIds: uniqueIds });
    return { ok: true, heldProducts: [] };
  } catch (error) {
    logError(`${LOG_PREFIX} payment:validate:error`, error);
    throw error;
  }
}

async function rollbackOrderUpgrades(
  orderId: string,
  upgradedProductIds: string[],
) {
  const redis = await RedisClient.getInstance();
  for (const productId of upgradedProductIds) {
    const key = pendingProductKey(productId);
    const raw = await redis.get(key);
    const lock = parseLock(raw);
    if (lock?.phase === "order" && lock.orderId === orderId) {
      await redis.del(key);
    }
  }
}

export async function commitOrderProductLocks(
  userId: string,
  orderId: string,
  productIds: string[],
): Promise<CommitOrderLocksResult> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  lockLog("order:commit:start", { userId, orderId, productIds: uniqueIds });
  if (uniqueIds.length === 0) {
    return { ok: true };
  }

  try {
    const redis = await RedisClient.getInstance();
    const heldProducts: HeldProduct[] = [];
    const upgraded: string[] = [];
    const orderValue = buildLockValue(userId, "order", orderId);

    for (const productId of uniqueIds) {
      const key = pendingProductKey(productId);
      const raw = await redis.get(key);
      const lock = parseLock(raw);

      if (lock?.phase === "order" && lock.orderId === orderId && lock.userId === userId) {
        upgraded.push(productId);
        lockLog("order:commit:already-upgraded", { userId, orderId, productId });
        continue;
      }

      if (!lock || lock.phase !== "checkout" || lock.userId !== userId) {
        const reason = lock ? "checkout_in_progress" : "hold_expired";
        heldProducts.push({ productId, reason });
        lockLog("order:commit:invalid-hold", {
          userId,
          orderId,
          productId,
          reason,
          lock,
        });
        continue;
      }

      const updated = await redis.set(key, orderValue, {
        XX: true,
        EX: ORDER_HOLD_TTL_SECONDS,
      });

      if (!updated) {
        heldProducts.push({ productId, reason: "checkout_in_progress" });
        lockLog("order:commit:upgrade-failed", { userId, orderId, productId });
        continue;
      }

      upgraded.push(productId);
      lockLog("order:commit:upgraded", {
        userId,
        orderId,
        productId,
        ttl: ORDER_HOLD_TTL_SECONDS,
      });
    }

    if (heldProducts.length > 0) {
      await rollbackOrderUpgrades(orderId, upgraded);
      const code = heldProducts.some((item) => item.reason === "hold_expired")
        ? "HOLD_EXPIRED"
        : "ITEMS_ON_HOLD";
      lockLog("order:commit:failed", { userId, orderId, code, heldProducts });
      return { ok: false, code, heldProducts };
    }

    lockLog("order:commit:success", { userId, orderId, upgraded });
    return { ok: true };
  } catch (error) {
    logError(`${LOG_PREFIX} order:commit:error`, error);
    throw error;
  }
}

export async function releaseProductLocksForOrder(order: {
  orderId?: string;
  cartData?: {
    cart?: { items?: Array<{ productId?: unknown; productDetails?: { _id?: unknown } }> };
  };
}) {
  const orderId = order?.orderId ? String(order.orderId) : "";
  if (!orderId) return;

  const productIds = extractProductIdsFromCart(order.cartData ?? {});
  lockLog("order:release:start", { orderId, productIds });
  if (productIds.length === 0) return;

  try {
    const redis = await RedisClient.getInstance();
    const released: string[] = [];

    for (const productId of productIds) {
      const key = pendingProductKey(productId);
      const raw = await redis.get(key);
      const lock = parseLock(raw);
      if (lock?.orderId === orderId) {
        await redis.del(key);
        released.push(productId);
      }
    }
    lockLog("order:release:done", { orderId, released });
  } catch (error) {
    logError(`${LOG_PREFIX} order:release:error`, error);
  }
}

export async function releaseProductLocksAfterFailedInsert(
  orderId: string,
  productIds: string[],
) {
  lockLog("order:release:after-failed-insert", { orderId, productIds });
  await rollbackOrderUpgrades(orderId, productIds);
}
